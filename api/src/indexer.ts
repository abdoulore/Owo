import { getPublicClient } from "./relayer.js";
import { db } from "./db.js";
import { config } from "./config.js";
import { remitEscrowAbi } from "./abi/remitEscrow.js";

const POLL_INTERVAL_MS = 4_000;
const MAX_BLOCK_RANGE = 2_000n; // per-poll cap so a long-dead process doesn't request an unbounded range

function getCursor(): bigint | null {
  const row = db.prepare("SELECT block FROM cursor WHERE key = 'escrow'").get() as
    | { block: number }
    | undefined;
  return row ? BigInt(row.block) : null;
}

function setCursor(block: bigint) {
  db.prepare("INSERT OR REPLACE INTO cursor (key, block) VALUES ('escrow', ?)").run(Number(block));
}

async function pollOnce() {
  const publicClient = getPublicClient();
  const latest = await publicClient.getBlockNumber();

  let fromBlock = getCursor();
  if (fromBlock === null) {
    fromBlock = latest;
    setCursor(fromBlock);
    return;
  }

  if (fromBlock >= latest) return;

  const toBlock = fromBlock + MAX_BLOCK_RANGE < latest ? fromBlock + MAX_BLOCK_RANGE : latest;

  const logs = await publicClient.getLogs({
    address: config.escrowAddress(),
    events: remitEscrowAbi.filter((item) => item.type === "event"),
    fromBlock: fromBlock + 1n,
    toBlock,
  });

  for (const log of logs) {
    processLog(log);
  }

  setCursor(toBlock);
}

function processLog(log: {
  eventName?: string;
  args: Record<string, unknown>;
  transactionHash: string;
}) {
  switch (log.eventName) {
    case "Sent": {
      // Match on claim_hash, not claim_id_onchain: the on-chain id is normally
      // recorded by POST /links/:id/funded, but if the sender's client dies between
      // the on-chain send and that call, claim_id_onchain is still NULL — the hash
      // (stored at link creation, emitted in the event) is the only reliable join
      // key, and this path is what makes funding survive a client crash.
      const claimId = Number(log.args.claimId as bigint);
      const claimHash = (log.args.claimHash as string).toLowerCase();
      const result = db
        .prepare(
          `UPDATE links SET status = 'funded', claim_id_onchain = ?, fund_tx = ?
           WHERE lower(claim_hash) = ? AND status = 'created'`
        )
        .run(claimId, log.transactionHash, claimHash);
      if (result.changes > 0) {
        console.log(`[indexer] funded claimId=${claimId} tx=${log.transactionHash}`);
      }
      break;
    }
    case "Claimed": {
      const claimId = Number(log.args.claimId as bigint);
      const recipient = log.args.recipient as string;
      db.prepare(
        "UPDATE links SET status = 'claimed', claim_tx = ?, recipient = ? WHERE claim_id_onchain = ?"
      ).run(log.transactionHash, recipient, claimId);
      console.log(`[indexer] claimed claimId=${claimId} tx=${log.transactionHash}`);
      break;
    }
    case "Reclaimed": {
      const claimId = Number(log.args.claimId as bigint);
      db.prepare(
        "UPDATE links SET status = 'reclaimed', reclaim_tx = ? WHERE claim_id_onchain = ?"
      ).run(log.transactionHash, claimId);
      console.log(`[indexer] reclaimed claimId=${claimId} tx=${log.transactionHash}`);
      break;
    }
  }
}

let pollHandle: ReturnType<typeof setInterval> | undefined;

export async function startIndexer() {
  await pollOnce().catch((err) => console.error("[indexer] initial poll failed:", err));

  pollHandle = setInterval(() => {
    pollOnce().catch((err) => console.error("[indexer] poll failed:", err));
  }, POLL_INTERVAL_MS);

  console.log("[indexer] started");
}

export function stopIndexer() {
  if (pollHandle) clearInterval(pollHandle);
}
