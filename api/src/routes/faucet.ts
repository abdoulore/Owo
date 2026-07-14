import { Router } from "express";
import { mintTestUsdc } from "../relayer.js";

export const faucetRouter = Router();

// POST /faucet  { address } -> mints test USDC to the account so a fresh sign-in
// has money to send. Testnet-only demo affordance; the amount and cap live in the
// relayer. Returns { funded } so the client knows whether a balance change is coming.
faucetRouter.post("/", async (req, res) => {
  const { address } = req.body ?? {};

  if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: "a valid address is required" });
    return;
  }

  try {
    const { txHash } = await mintTestUsdc(address as `0x${string}`);
    res.json({ funded: txHash !== null, txHash });
  } catch (err) {
    console.error("[faucet] mint failed:", (err as Error).message);
    res.status(502).json({ error: "Couldn't add test money right now. Try again." });
  }
});
