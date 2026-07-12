import { Router } from "express";
import { db } from "../db.js";
import { config } from "../config.js";
import { getPublicClient } from "../relayer.js";
import { remitEscrowAbi, TransferStatus } from "../abi/remitEscrow.js";

export const reclaimsRouter = Router();

// reclaim() is called directly from the sender's own smart account (they're present,
// tapping "Cancel"), sponsored via the frontend's account-abstraction provider — not
// submitted by this backend. This endpoint just verifies the on-chain result and
// records it, mirroring POST /links/:id/funded.
reclaimsRouter.post("/", async (req, res) => {
  const { linkId, reclaimTx } = req.body ?? {};

  if (typeof linkId !== "string" || typeof reclaimTx !== "string") {
    res.status(400).json({ error: "linkId and reclaimTx are required" });
    return;
  }

  const row = db.prepare("SELECT * FROM links WHERE id = ?").get(linkId) as
    | { claim_id_onchain: number | null; status: string }
    | undefined;

  if (!row) {
    res.status(404).json({ error: "This link doesn't exist" });
    return;
  }
  if (row.claim_id_onchain === null) {
    res.status(409).json({ error: "This link was never funded on-chain" });
    return;
  }
  if (row.status === "reclaimed") {
    res.json({ status: "reclaimed" });
    return;
  }

  const onchain = await getPublicClient().readContract({
    address: config.escrowAddress(),
    abi: remitEscrowAbi,
    functionName: "transfers",
    args: [BigInt(row.claim_id_onchain)],
  });
  const [, , , , , onchainStatus] = onchain;

  if (onchainStatus !== TransferStatus.Reclaimed) {
    res.status(409).json({ error: "On-chain state doesn't show this as reclaimed" });
    return;
  }

  db.prepare("UPDATE links SET status = 'reclaimed', reclaim_tx = ? WHERE id = ?").run(reclaimTx, linkId);

  res.json({ status: "reclaimed" });
});
