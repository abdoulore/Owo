import { Router } from "express";
import { keccak256 } from "viem";
import { db } from "../db.js";
import { submitClaim } from "../relayer.js";

export const claimsRouter = Router();

claimsRouter.post("/", async (req, res) => {
  const { linkId, recipient, secret } = req.body ?? {};

  if (typeof linkId !== "string" || typeof recipient !== "string" || typeof secret !== "string") {
    res.status(400).json({ error: "linkId, recipient, and secret are required" });
    return;
  }
  if (!/^0x[0-9a-fA-F]+$/.test(secret)) {
    res.status(400).json({ error: "secret must be a hex string" });
    return;
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
    res.status(400).json({ error: "recipient must be an address" });
    return;
  }

  const row = db.prepare("SELECT * FROM links WHERE id = ?").get(linkId) as
    | { status: string; claim_hash: string; claim_id_onchain: number | null; expiry: number | null }
    | undefined;

  if (!row) {
    res.status(404).json({ error: "This link doesn't exist" });
    return;
  }
  if (row.status === "claimed") {
    res.status(409).json({ error: "This link was already claimed" });
    return;
  }
  if (row.status === "reclaimed") {
    res.status(409).json({ error: "This link was cancelled by the sender" });
    return;
  }
  if (row.status !== "funded" || row.claim_id_onchain === null) {
    res.status(409).json({ error: "This link isn't ready to claim yet" });
    return;
  }
  if (row.expiry !== null && Date.now() >= row.expiry * 1000) {
    res.status(409).json({ error: "This link has expired" });
    return;
  }
  if (keccak256(secret as `0x${string}`).toLowerCase() !== row.claim_hash.toLowerCase()) {
    res.status(400).json({ error: "That claim link looks broken" });
    return;
  }

  const now = Date.now();
  const insert = db
    .prepare(
      `INSERT INTO relayer_queue (kind, link_id, payload, status, created_at, updated_at)
       VALUES ('claim', ?, ?, 'pending', ?, ?)`
    )
    .run(linkId, JSON.stringify({ claimIdOnchain: row.claim_id_onchain, recipient }), now, now);

  try {
    const { txHash } = await submitClaim({
      queueId: Number(insert.lastInsertRowid),
      claimIdOnchain: row.claim_id_onchain,
      secret: secret as `0x${string}`,
      recipient: recipient as `0x${string}`,
    });
    res.json({ status: "claimed", txHash });
  } catch {
    res.status(502).json({ error: "Something went wrong claiming this. Try again." });
  }
});
