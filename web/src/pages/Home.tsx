import { useEffect, useState } from "react";
import { api, type HistoryEntry } from "../lib/api";
import { formatUsdcAmount } from "../lib/money";
import { getSmartAccountAddress, reclaimPayment } from "../lib/zerodev";

// TODO(Phase 3): balance hero, sent/received lists, NGN toggle, empty/loading states
// designed per the payment-app aesthetic. Logic below is functionally complete.
export function Home() {
  const [pending, setPending] = useState<HistoryEntry[]>([]);
  const [reclaimingId, setReclaimingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const address = await getSmartAccountAddress();
    const history = await api.getHistory(address);
    setPending(history.pending);
  }

  useEffect(() => {
    refresh().catch((err) => setError((err as Error).message));
  }, []);

  async function handleCancel(entry: HistoryEntry) {
    if (entry.claimIdOnchain === null) return;
    setReclaimingId(entry.linkId);
    setError(null);

    try {
      const { reclaimTx } = await reclaimPayment(entry.claimIdOnchain);
      await api.markReclaimed({ linkId: entry.linkId, reclaimTx });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReclaimingId(null);
    }
  }

  return (
    <main>
      <h1>Home</h1>
      {error && <p role="alert">{error}</p>}
      <ul>
        {pending.map((entry) => (
          <li key={entry.linkId}>
            ${formatUsdcAmount(BigInt(entry.amount))} — {entry.status}
            {entry.status === "expired" && (
              <button
                type="button"
                disabled={reclaimingId === entry.linkId}
                onClick={() => handleCancel(entry)}
              >
                {reclaimingId === entry.linkId ? "Cancelling…" : "Cancel"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
