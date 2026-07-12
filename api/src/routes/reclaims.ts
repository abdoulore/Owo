import { Router } from "express";

export const reclaimsRouter = Router();

// POST /reclaims — relayer submits reclaim() for sender after expiry.
// TODO(Phase 2): validate expiry has passed, enqueue on relayer.
reclaimsRouter.post("/", (_req, res) => {
  res.status(501).json({ error: "not implemented" });
});
