import Database from "better-sqlite3";

const DATABASE_PATH = process.env.DATABASE_PATH ?? "./owo.db";

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
    recipient TEXT,
    status TEXT NOT NULL DEFAULT 'created',
    fund_tx TEXT,
    claim_tx TEXT,
    expiry INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cursor (
    key TEXT PRIMARY KEY,
    block INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS relayer_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    tx_hash TEXT,
    created_at INTEGER NOT NULL
  );
`);
