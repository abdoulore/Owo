import { Router } from "express";
import { db } from "../db.js";
import { derivedStatus, type LinkRow } from "../lib/linkStatus.js";

export const historyRouter = Router();

function toSummary(row: LinkRow) {
  return {
    linkId: row.id,
    amount: row.amount,
    note: row.note,
    status: derivedStatus(row),
    createdAt: row.created_at,
    fundTx: row.fund_tx,
    claimTx: row.claim_tx,
    reclaimTx: row.reclaim_tx,
  };
}

historyRouter.get("/:address", (req, res) => {
  const address = req.params.address.toLowerCase();

  const sent = db
    .prepare("SELECT * FROM links WHERE lower(sender) = ? ORDER BY created_at DESC")
    .all(address) as LinkRow[];

  const received = db
    .prepare("SELECT * FROM links WHERE lower(recipient) = ? ORDER BY created_at DESC")
    .all(address) as LinkRow[];

  const pending = sent.filter((row) => derivedStatus(row) === "funded" || derivedStatus(row) === "created");

  res.json({
    sent: sent.map(toSummary),
    received: received.map(toSummary),
    pending: pending.map(toSummary),
  });
});
