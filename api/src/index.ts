import "dotenv/config";
import express from "express";
import cors from "cors";
import { linksRouter } from "./routes/links.js";
import { claimsRouter } from "./routes/claims.js";
import { reclaimsRouter } from "./routes/reclaims.js";
import { historyRouter } from "./routes/history.js";
import { faucetRouter } from "./routes/faucet.js";
import { getRelayerHealth } from "./relayer.js";
import { startIndexer, stopIndexer } from "./indexer.js";
import { config } from "./config.js";
import { db } from "./db.js";

const app = express();
// Most PaaS hosts (Railway, Render, Heroku) inject their own PORT and route
// traffic only to it, regardless of what the app is configured to listen on.
const PORT = process.env.PORT ?? config.apiPort;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/relayer/health", async (_req, res) => {
  try {
    res.json(await getRelayerHealth());
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.use("/links", linksRouter);
app.use("/claims", claimsRouter);
app.use("/reclaims", reclaimsRouter);
app.use("/history", historyRouter);
app.use("/faucet", faucetRouter);

const server = app.listen(PORT, () => {
  console.log(`[api] listening on :${PORT}`);
});

try {
  config.escrowAddress();
  config.arbitrumSepoliaRpc();
  startIndexer().catch((err) => console.error("[indexer] failed to start:", err));
} catch {
  console.warn("[indexer] ESCROW_ADDRESS/ARBITRUM_SEPOLIA_RPC not set, skipping indexer startup");
}

// PaaS hosts send SIGTERM to retire a container on every redeploy. Without a
// handler the process is hard-killed (npm reports it as an error) and SQLite's
// WAL is left to recover on next boot. Shut down cleanly instead: stop the poll
// loop, stop accepting requests, checkpoint + close the DB, then exit 0.
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[api] ${signal} received, shutting down`);
  stopIndexer();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  // Don't hang forever if a connection won't drain.
  setTimeout(() => process.exit(0), 5_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
