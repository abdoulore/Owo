import { Router } from "express";

export const claimsRouter = Router();

// POST /claims — body: { linkId, recipient, secret }. Relayer submits claim() sponsored.
// Secret is used in the tx and never persisted.
// TODO(Phase 2): enqueue on relayer, return pending state.
claimsRouter.post("/", (_req, res) => {
  res.status(501).json({ error: "not implemented" });
});
