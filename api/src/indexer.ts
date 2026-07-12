import { getPublicClient } from "./relayer.js";
import { db } from "./db.js";
import { config } from "./config.js";
import { remitEscrowAbi } from "./abi/remitEscrow.js";

const POLL_INTERVAL_MS = 4_000;
// Alchemy's free tier caps eth_getLogs to a 10-block range per request (confirmed
// against the actual deployed endpoint). Arbitrum Sepolia produces blocks far
// faster than 10 blocks per POLL_INTERVAL_MS (measured ~5/sec, sometimes more) --
// one chunk per tick falls further behind forever and never confirms a claim.
// pollOnce() below loops through consecutive chunks within a single tick until
// caught up, paced with CHUNK_DELAY_MS so it doesn't blow through the free
// tier's compute-units-per-second cap (confirmed empirically: unpaced looping
// hit 429s constantly while catching up).
const MAX_BLOCK_RANGE = 10n;
const MAX_CHUNKS_PER_TICK = 30; // ~300 blocks/tick before yielding to the next interval
const CHUNK_DELAY_MS = 250;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  const cursor = getCursor();
  if (cursor === null) {
    const latest = await publicClient.getBlockNumber();
    setCursor(latest);
    return;
  }

  let fromBlock: bigint = cursor;

  for (let chunk = 0; chunk < MAX_CHUNKS_PER_TICK; chunk++) {
    const latest = await publicClient.getBlockNumber();
    if (fromBlock >= latest) return;

    const toBlock: bigint = fromBlock + MAX_BLOCK_RANGE < latest ? fromBlock + MAX_BLOCK_RANGE : latest;

    let logs;
    try {
      logs = await publicClient.getLogs({
        address: config.escrowAddress(),
        events: remitEscrowAbi.filter((item) => item.type === "event"),
        fromBlock: fromBlock + 1n,
        toBlock,
      });
    } catch (err) {
      // Rate-limited or transient RPC error mid-catch-up: stop this tick quietly
      // and resume from the last successfully-saved cursor on the next tick,
      // rather than throw (which would just log the same noisy error every poll
      // until caught up).
      console.warn(`[indexer] chunk fetch failed, will resume next tick:`, (err as Error).message);
      return;
    }

    for (const log of logs) {
      if (log.transactionHash) processLog({ ...log, transactionHash: log.transactionHash });
    }

    setCursor(toBlock);
    fromBlock = toBlock;

    if (chunk < MAX_CHUNKS_PER_TICK - 1 && fromBlock < latest) await sleep(CHUNK_DELAY_MS);
  }
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
