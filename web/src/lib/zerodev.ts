import { createPublicClient, http, parseEventLogs, encodeFunctionData, type Hex } from "viem";
import { arbitrumSepolia } from "viem/chains";
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from "@zerodev/sdk";
import { KERNEL_V3_1, getEntryPoint } from "@zerodev/sdk/constants";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { magic } from "./magic";
import { config } from "./config";
import { remitEscrowAbi } from "../abi/remitEscrow";
import { usdcAbi } from "../abi/usdc";

const entryPoint = getEntryPoint("0.7");
const kernelVersion = KERNEL_V3_1;

function zerodevRpc(): string {
  return `https://rpc.zerodev.app/api/v3/${config.zerodevProjectId()}/chain/${arbitrumSepolia.id}`;
}

type KernelClient = Awaited<ReturnType<typeof buildKernelClient>>;
let kernelClientPromise: Promise<KernelClient> | null = null;

/// magic.rpcProvider is a standard EIP-1193 provider, which ZeroDev's Signer type
/// accepts directly — the user's Google-login-derived key becomes the smart
/// account's owner/validator, with no separate wallet-wrapping step needed.
async function buildKernelClient() {
  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(config.arbitrumSepoliaRpc()),
  });

  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: magic.rpcProvider,
    entryPoint,
    kernelVersion,
  });

  const account = await createKernelAccount(publicClient, {
    plugins: { sudo: ecdsaValidator },
    entryPoint,
    kernelVersion,
  });

  const paymasterClient = createZeroDevPaymasterClient({
    chain: arbitrumSepolia,
    transport: http(zerodevRpc()),
  });

  return createKernelAccountClient({
    account,
    chain: arbitrumSepolia,
    bundlerTransport: http(zerodevRpc()),
    client: publicClient,
    paymaster: {
      getPaymasterData: (userOperation) =>
        paymasterClient.sponsorUserOperation({ userOperation }),
    },
  });
}

/// Cached per browser session; call resetKernelClient() on logout so the next
/// login builds a fresh one against the newly logged-in Magic signer.
function getKernelClient(): Promise<KernelClient> {
  if (!kernelClientPromise) kernelClientPromise = buildKernelClient();
  return kernelClientPromise;
}

export function resetKernelClient() {
  kernelClientPromise = null;
}

export async function getSmartAccountAddress(): Promise<`0x${string}`> {
  const client = await getKernelClient();
  return client.account.address;
}

/// Submits a batched UserOperation and waits for its receipt. sendUserOperation
/// and waitForUserOperationReceipt can throw raw paymaster/bundler errors (JSON-RPC
/// blobs, ZeroDev policy-rejection text) -- never surface those directly in the UI.
async function submitUserOp(client: KernelClient, callData: Hex) {
  try {
    const userOpHash = await client.sendUserOperation({ callData });
    return await client.waitForUserOperationReceipt({ hash: userOpHash, timeout: 30_000 });
  } catch (err) {
    console.error("[zerodev] userOp failed:", err);
    throw new Error("Something went wrong. Try again.");
  }
}

/// Sends a payment: batches the USDC approval and the escrow send() into a single
/// sponsored UserOperation, so the user never sees a separate "approve" step.
/// Returns the on-chain claimId (parsed from the Sent event) and the fund tx hash,
/// exactly what POST /links/:id/funded needs.
export async function sendPayment(params: {
  amount: bigint;
  claimHash: Hex;
  expiry: number;
}): Promise<{ claimId: number; fundTx: Hex }> {
  const client = await getKernelClient();

  const callData = await client.account.encodeCalls([
    {
      to: config.usdcAddress(),
      value: 0n,
      data: encodeApprove(config.escrowAddress(), params.amount),
    },
    {
      to: config.escrowAddress(),
      value: 0n,
      data: encodeSend(config.usdcAddress(), params.amount, params.claimHash, params.expiry),
    },
  ]);

  const receipt = await submitUserOp(client, callData);

  if (!receipt.success) {
    throw new Error("Something went wrong sending this. Try again.");
  }

  const [sentEvent] = parseEventLogs({
    abi: remitEscrowAbi,
    eventName: "Sent",
    logs: receipt.logs,
  });
  if (!sentEvent) throw new Error("Couldn't confirm the transfer on-chain. Try again.");

  return { claimId: Number(sentEvent.args.claimId), fundTx: receipt.receipt.transactionHash };
}

/// Cancels an unclaimed, expired link, returning funds to the sender. Called
/// directly from the sender's own smart account while they're present (tapping
/// "Cancel" on Home) — never by the backend relayer.
export async function reclaimPayment(claimId: number): Promise<{ reclaimTx: Hex }> {
  const client = await getKernelClient();

  const callData = await client.account.encodeCalls([
    {
      to: config.escrowAddress(),
      value: 0n,
      data: encodeReclaim(claimId),
    },
  ]);

  const receipt = await submitUserOp(client, callData);

  if (!receipt.success) {
    throw new Error("Something went wrong cancelling this. Try again.");
  }

  return { reclaimTx: receipt.receipt.transactionHash };
}

function encodeApprove(spender: `0x${string}`, amount: bigint) {
  return encodeFunctionData({ abi: usdcAbi, functionName: "approve", args: [spender, amount] });
}

function encodeSend(token: `0x${string}`, amount: bigint, claimHash: Hex, expiry: number) {
  return encodeFunctionData({
    abi: remitEscrowAbi,
    functionName: "send",
    args: [token, amount, claimHash, BigInt(expiry)],
  });
}

function encodeReclaim(claimId: number) {
  return encodeFunctionData({ abi: remitEscrowAbi, functionName: "reclaim", args: [BigInt(claimId)] });
}
