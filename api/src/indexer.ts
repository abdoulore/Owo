import { getPublicClient } from "./relayer.js";
import { db } from "./db.js";

// TODO(Phase 2): poll or WS-subscribe to Sent, Claimed, Reclaimed events on ESCROW_ADDRESS.
// Update `links` status: created -> funded -> claimed | reclaimed | expired.
// Store txHash per state transition. On startup, backfill from `cursor` table.

export async function startIndexer() {
  const publicClient = getPublicClient();
  const row = db.prepare("SELECT block FROM cursor WHERE key = 'escrow'").get() as
    | { block: number }
    | undefined;

  const fromBlock = row ? BigInt(row.block) : await publicClient.getBlockNumber();
  db.prepare("INSERT OR REPLACE INTO cursor (key, block) VALUES ('escrow', ?)").run(
    Number(fromBlock)
  );

  console.log(`[indexer] cursor at block ${fromBlock}`);
}
