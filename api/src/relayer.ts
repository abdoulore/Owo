import { createWalletClient, createPublicClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { config } from "./config.js";
import { db } from "./db.js";
import { remitEscrowAbi } from "./abi/remitEscrow.js";

const MAX_ATTEMPTS = 3;
const CONFIRMATION_TIMEOUT_MS = 15_000;
const GAS_BUMP_STEP = 30n; // +30% maxFeePerGas/maxPriorityFeePerGas per retry

let publicClientSingleton: ReturnType<typeof createPublicClient> | undefined;
let walletClientSingleton: ReturnType<typeof createWalletClient> | undefined;

export function getRelayerAccount() {
  return privateKeyToAccount(config.relayerPrivateKey());
}

export function getPublicClient() {
  if (!publicClientSingleton) {
    publicClientSingleton = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(config.arbitrumSepoliaRpc()),
    });
  }
  return publicClientSingleton;
}

function getWalletClient() {
  if (!walletClientSingleton) {
    walletClientSingleton = createWalletClient({
      account: getRelayerAccount(),
      chain: arbitrumSepolia,
      transport: http(config.arbitrumSepoliaRpc()),
    });
  }
  return walletClientSingleton;
}

// Serializes nonce allocation across concurrent submissions from a single relayer key.
// Node is single-threaded, so a promise chain is sufficient — no real mutex needed.
let nonceChain: Promise<number> | undefined;

async function nextNonce(): Promise<number> {
  const publicClient = getPublicClient();
  const account = getRelayerAccount();

  if (!nonceChain) {
    nonceChain = publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
  }
  const thisNonce = nonceChain;
  nonceChain = thisNonce.then((n) => n + 1);
  return thisNonce;
}

function resetNonceFromChain() {
  nonceChain = undefined;
}

export interface ClaimJob {
  queueId: number;
  claimIdOnchain: number;
  secret: Hex;
  recipient: `0x${string}`;
}

function updateQueueRow(
  queueId: number,
  fields: { status?: string; tx_hash?: string; attempts?: number; error?: string }
) {
  const sets = Object.keys(fields).map((key) => `${key} = ?`);
  const values = Object.values(fields);
  db.prepare(`UPDATE relayer_queue SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`).run(
    ...values,
    Date.now(),
    queueId
  );
}

async function sendClaimTx(
  job: ClaimJob,
  nonce: number,
  gasMultiplierPct: bigint
): Promise<Hex> {
  const walletClient = getWalletClient();
  const publicClient = getPublicClient();
  const account = getRelayerAccount();

  const baseFees = await publicClient.estimateFeesPerGas();
  const maxFeePerGas = (baseFees.maxFeePerGas * gasMultiplierPct) / 100n;
  const maxPriorityFeePerGas = (baseFees.maxPriorityFeePerGas * gasMultiplierPct) / 100n;

  return walletClient.writeContract({
    address: config.escrowAddress(),
    abi: remitEscrowAbi,
    functionName: "claim",
    args: [BigInt(job.claimIdOnchain), job.secret, job.recipient],
    account,
    chain: arbitrumSepolia,
    nonce,
    maxFeePerGas,
    maxPriorityFeePerGas,
  });
}

/// Submits claim() sponsored by the relayer, retrying with a gas bump on the same
/// nonce if the tx doesn't confirm within the timeout, up to MAX_ATTEMPTS total.
/// The secret lives only in this call's stack — never written to relayer_queue —
/// so a process restart mid-flight simply loses the ability to auto-retry; the
/// client can safely re-POST /claims, since the contract's Pending check makes
/// resubmission idempotent-safe.
export async function submitClaim(job: ClaimJob): Promise<{ txHash: Hex }> {
  let nonce = await nextNonce();
  let gasMultiplierPct = 100n;
  let lastError: unknown;
  const submittedTxs: Hex[] = [];

  const settleConfirmed = (txHash: Hex) => {
    updateQueueRow(job.queueId, { status: "confirmed", tx_hash: txHash });
    console.log(`[relayer] claim confirmed claimId=${job.claimIdOnchain} tx=${txHash}`);
    return { txHash };
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const txHash = await sendClaimTx(job, nonce, gasMultiplierPct);
      submittedTxs.push(txHash);
      console.log(`[relayer] claim submitted claimId=${job.claimIdOnchain} attempt=${attempt} tx=${txHash}`);
      updateQueueRow(job.queueId, { status: "submitted", tx_hash: txHash, attempts: attempt });

      const confirmed = await waitForConfirmation(txHash);
      if (confirmed) return settleConfirmed(txHash);

      console.warn(`[relayer] claim stuck, bumping gas claimId=${job.claimIdOnchain} attempt=${attempt + 1}`);
      gasMultiplierPct += GAS_BUMP_STEP;
    } catch (err) {
      lastError = err;
      console.error(`[relayer] claim submission attempt ${attempt} failed:`, (err as Error).message);

      // Any error on a RETRY while an earlier tx of ours is in flight usually
      // means that tx is winning: a nonce error means it consumed the nonce, and
      // a NotPending simulation revert means pending state already shows the
      // claim going through. Wait for it properly — an instant receipt check
      // would race a tx that lands moments later and report a false failure.
      if (submittedTxs.length > 0) {
        const landed = await waitForAnyLanded(submittedTxs);
        if (landed) return settleConfirmed(landed);
      }

      // Nothing of ours landed: if the nonce is stale (consumed elsewhere or out
      // of sync), re-acquire for THIS attempt loop, not just future jobs —
      // otherwise every retry replays the same dead nonce.
      if (/nonce|already known|replacement/i.test((err as Error).message ?? "")) {
        resetNonceFromChain();
        nonce = await nextNonce();
      }
      gasMultiplierPct += GAS_BUMP_STEP;
    }
  }

  const landed = await waitForAnyLanded(submittedTxs);
  if (landed) return settleConfirmed(landed);

  updateQueueRow(job.queueId, {
    status: "failed",
    attempts: MAX_ATTEMPTS,
    error: (lastError as Error)?.message ?? "stuck after max retries",
  });
  throw new Error("Failed to submit claim after retries");
}

/// Waits one confirmation window on the most recent in-flight tx, then falls back
/// to an instant receipt sweep of all of them (an older replacement may have won).
async function waitForAnyLanded(txHashes: Hex[]): Promise<Hex | null> {
  if (txHashes.length === 0) return null;
  const latest = txHashes[txHashes.length - 1];
  if (await waitForConfirmation(latest)) return latest;
  return findLandedTx(txHashes);
}

async function findLandedTx(txHashes: Hex[]): Promise<Hex | null> {
  const publicClient = getPublicClient();
  for (const hash of txHashes) {
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash });
      if (receipt.status === "success") return hash;
    } catch {
      // not mined (or dropped) — keep checking the others
    }
  }
  return null;
}

async function waitForConfirmation(txHash: Hex): Promise<boolean> {
  try {
    const receipt = await getPublicClient().waitForTransactionReceipt({
      hash: txHash,
      timeout: CONFIRMATION_TIMEOUT_MS,
    });
    return receipt.status === "success";
  } catch {
    return false;
  }
}

export async function getRelayerHealth() {
  const account = getRelayerAccount();
  const publicClient = getPublicClient();
  const balance = await publicClient.getBalance({ address: account.address });

  const queueDepth = db
    .prepare("SELECT COUNT(*) as n FROM relayer_queue WHERE status IN ('pending', 'submitted')")
    .get() as { n: number };

  return {
    address: account.address,
    balance: balance.toString(),
    queueDepth: queueDepth.n,
  };
}
