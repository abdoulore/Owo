import { randomBytes } from "node:crypto";
import { Router } from "express";
import { db } from "../db.js";
import { config, DEFAULT_EXPIRY_SECONDS } from "../config.js";
import { getPublicClient } from "../relayer.js";
import { remitEscrowAbi, TransferStatus } from "../abi/remitEscrow.js";
import { derivedStatus, type LinkRow } from "../lib/linkStatus.js";

export const linksRouter = Router();

function generateLinkId(): string {
  return randomBytes(9).toString("base64url");
}

linksRouter.post("/", (req, res) => {
  const { amount, note, senderAddress, senderDisplay, claimHash } = req.body ?? {};

  if (typeof amount !== "string" || typeof senderAddress !== "string" || typeof claimHash !== "string") {
    res.status(400).json({ error: "amount, senderAddress, and claimHash are required" });
    return;
  }

  let amountBigint: bigint;
  try {
    amountBigint = BigInt(amount);
  } catch {
    res.status(400).json({ error: "amount must be an integer string in base units" });
    return;
  }
  if (amountBigint <= 0n) {
    res.status(400).json({ error: "amount must be positive" });
    return;
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(claimHash)) {
    res.status(400).json({ error: "claimHash must be a 32-byte hex string" });
    return;
  }

  const id = generateLinkId();
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + DEFAULT_EXPIRY_SECONDS;

  db.prepare(
    `INSERT INTO links (id, claim_hash, amount, note, sender, sender_display, status, expiry, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'created', ?, ?)`
  ).run(id, claimHash, amount, note ?? null, senderAddress, senderDisplay ?? null, expiry, Date.now());

  res.status(201).json({ linkId: id, expiry });
});

linksRouter.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM links WHERE id = ?").get(req.params.id) as LinkRow | undefined;

  if (!row) {
    res.status(404).json({ error: "This link doesn't exist" });
    return;
  }

  res.json({
    amount: row.amount,
    note: row.note,
    senderDisplay: row.sender_display,
    sender: row.sender,
    status: derivedStatus(row),
  });
});

linksRouter.post("/:id/funded", async (req, res) => {
  const { claimIdOnchain, fundTx } = req.body ?? {};

  if (typeof claimIdOnchain !== "number" || typeof fundTx !== "string") {
    res.status(400).json({ error: "claimIdOnchain and fundTx are required" });
    return;
  }

  const row = db.prepare("SELECT * FROM links WHERE id = ?").get(req.params.id) as LinkRow | undefined;
  if (!row) {
    res.status(404).json({ error: "This link doesn't exist" });
    return;
  }
  if (row.status !== "created") {
    res.json({ status: derivedStatus(row) });
    return;
  }

  const onchain = await getPublicClient().readContract({
    address: config.escrowAddress(),
    abi: remitEscrowAbi,
    functionName: "transfers",
    args: [BigInt(claimIdOnchain)],
  });
  const [onchainSender, , onchainAmount, onchainClaimHash, , onchainStatus] = onchain;

  const senderMatches = onchainSender.toLowerCase() === row.sender.toLowerCase();
  const amountMatches = onchainAmount === BigInt(row.amount);
  const hashMatches = onchainClaimHash.toLowerCase() === row.claim_hash.toLowerCase();
  const notEmpty = onchainStatus === TransferStatus.Pending;

  if (!senderMatches || !amountMatches || !hashMatches || !notEmpty) {
    res.status(409).json({ error: "On-chain transfer doesn't match this link" });
    return;
  }

  db.prepare(
    "UPDATE links SET status = 'funded', claim_id_onchain = ?, fund_tx = ? WHERE id = ?"
  ).run(claimIdOnchain, fundTx, row.id);

  res.json({ status: "funded" });
});
