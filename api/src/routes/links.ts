import { Router } from "express";

export const linksRouter = Router();

// POST /links — client sends { amount, note?, senderAddress } + claimHash (never the secret).
// TODO(Phase 2): insert into `links` table, return { linkId }.
linksRouter.post("/", (_req, res) => {
  res.status(501).json({ error: "not implemented" });
});

// POST /links/:id/funded — client notifies after on-chain send confirms.
// TODO(Phase 2): indexer verifies independently before flipping status.
linksRouter.post("/:id/funded", (_req, res) => {
  res.status(501).json({ error: "not implemented" });
});

// GET /links/:id — public claim metadata, no secret/hash exposure.
// TODO(Phase 2): return { amount, note, senderDisplay, status }.
linksRouter.get("/:id", (_req, res) => {
  res.status(501).json({ error: "not implemented" });
});
