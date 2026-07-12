import { useState } from "react";
import { keccak256, toHex, type Hex } from "viem";
import { api } from "../lib/api";
import { parseUsdcAmount } from "../lib/money";
import { getUserEmail } from "../lib/magic";
import { getSmartAccountAddress, sendPayment } from "../lib/zerodev";

// TODO(Phase 3): amount pad with big numerals, note field, share sheet, loading/error
// states designed per the payment-app aesthetic. Logic below is functionally complete.
export function Send() {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);

  async function handleCreateLink() {
    setStatus("working");
    setError(null);

    try {
      const amountBaseUnits = parseUsdcAmount(amount);

      const secretBytes = crypto.getRandomValues(new Uint8Array(32));
      const secret = toHex(secretBytes) as Hex;
      const claimHash = keccak256(secret);

      const [senderAddress, senderDisplay] = await Promise.all([
        getSmartAccountAddress(),
        getUserEmail(),
      ]);

      const { linkId, expiry } = await api.createLink({
        amount: amountBaseUnits.toString(),
        note: note || undefined,
        senderAddress,
        senderDisplay: senderDisplay ?? undefined,
        claimHash,
      });

      const { claimId, fundTx } = await sendPayment({ amount: amountBaseUnits, claimHash, expiry });

      await api.markFunded(linkId, { claimIdOnchain: claimId, fundTx });

      setShareLink(`${window.location.origin}/c/${linkId}#${secret.slice(2)}`);
      setStatus("idle");
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }

  if (shareLink) {
    return (
      <main>
        <p>Link ready:</p>
        <a href={shareLink}>{shareLink}</a>
      </main>
    );
  }

  return (
    <main>
      <h1>Send</h1>
      <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
      <button type="button" disabled={status === "working"} onClick={handleCreateLink}>
        {status === "working" ? "Sending…" : "Create link"}
      </button>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
