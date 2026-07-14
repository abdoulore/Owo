import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DATABASE_PATH = process.env.DATABASE_PATH ?? "./owo.db";

// better-sqlite3 creates the DB file but not its parent directory. On a host where
// DATABASE_PATH points at a mounted volume (e.g. /data/owo.db), the mount provides
// the dir; this mkdir just prevents a crash if it doesn't exist yet. The startup
// log prints the absolute path so it's obvious in the host logs whether the DB is
// living on the persistent volume or on ephemeral container storage.
mkdirSync(dirname(resolve(DATABASE_PATH)), { recursive: true });
console.log(`[db] opening SQLite at ${resolve(DATABASE_PATH)}`);

export const db = new Database(DATABASE_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY,
    claim_hash TEXT NOT NULL,
    claim_id_onchain INTEGER,
    amount TEXT NOT NULL,
    note TEXT,
    sender TEXT NOT NULL,
    sender_display TEXT,
    recipient TEXT,
    claim_locked_to TEXT,
    status TEXT NOT NULL DEFAULT 'created',
    fund_tx TEXT,
    claim_tx TEXT,
    reclaim_tx TEXT,
    expiry INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_links_sender ON links(sender);
  CREATE INDEX IF NOT EXISTS idx_links_recipient ON links(recipient);
  CREATE INDEX IF NOT EXISTS idx_links_claim_id_onchain ON links(claim_id_onchain);

  CREATE TABLE IF NOT EXISTS cursor (
    key TEXT PRIMARY KEY,
    block INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS relayer_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    link_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    tx_hash TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

// Migration for databases created before claim_locked_to existed (the CREATE above
// only adds it to fresh DBs). ALTER fails if the column is already present, so guard
// on the live schema. This is what locks a link to the first recipient that claims it.
const linkColumns = db.prepare("PRAGMA table_info(links)").all() as { name: string }[];
if (!linkColumns.some((c) => c.name === "claim_locked_to")) {
  db.exec("ALTER TABLE links ADD COLUMN claim_locked_to TEXT");
}
