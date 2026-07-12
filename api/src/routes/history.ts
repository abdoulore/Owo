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
    claimIdOnchain: row.claim_id_onchain,
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

  // Raw status, not derived: an expired-but-unclaimed link is still "pending" here —
  // it's what makes it show up with a Cancel (reclaim) button on Home.
  const pending = sent.filter((row) => row.status === "funded" || row.status === "created");

  res.json({
    sent: sent.map(toSummary),
    received: received.map(toSummary),
    pending: pending.map(toSummary),
  });
});
