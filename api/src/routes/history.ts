import { Router } from "express";

export const historyRouter = Router();

// GET /history/:address — sent/received/pending for the home screen.
// TODO(Phase 2): query `links` by sender/recipient.
historyRouter.get("/:address", (_req, res) => {
  res.status(501).json({ error: "not implemented" });
});
