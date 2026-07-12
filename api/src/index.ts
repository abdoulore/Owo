import express from "express";
import cors from "cors";
import { linksRouter } from "./routes/links.js";
import { claimsRouter } from "./routes/claims.js";
import { reclaimsRouter } from "./routes/reclaims.js";
import { historyRouter } from "./routes/history.js";
import { getRelayerHealth } from "./relayer.js";
import { startIndexer } from "./indexer.js";
import { config } from "./config.js";
import "./db.js";

const app = express();
const PORT = config.apiPort;

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

app.listen(PORT, () => {
  console.log(`[api] listening on :${PORT}`);
});

try {
  config.escrowAddress();
  config.arbitrumSepoliaRpc();
  startIndexer().catch((err) => console.error("[indexer] failed to start:", err));
} catch {
  console.warn("[indexer] ESCROW_ADDRESS/ARBITRUM_SEPOLIA_RPC not set, skipping indexer startup");
}
