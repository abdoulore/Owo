import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  PaperPlaneTilt,
  Plus,
  WarningCircle,
} from "@phosphor-icons/react";
import { api, type HistoryEntry } from "../lib/api";
import { formatUsdcAmount } from "../lib/money";
import { getSmartAccountAddress, reclaimPayment } from "../lib/zerodev";
import { getUsdcBalance } from "../lib/balance";
import { isLoggedIn, loginWithGoogle } from "../lib/magic";
import { Screen } from "../components/Screen";
import { AmountDisplay } from "../components/AmountDisplay";
import { StatusPill } from "../components/StatusPill";
import { AddMoneySheet } from "../components/AddMoneySheet";

// Below this, offer the top-up (matches the backend faucet's per-account cap).
const LOW_BALANCE = 50_000_000n; // 50 USDC (6 decimals)

type ActivityRow = HistoryEntry & { direction: "in" | "out" };

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function Home() {
  const [balance, setBalance] = useState<bigint | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reclaimingId, setReclaimingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  async function refresh() {
    const address = await getSmartAccountAddress();
    // allSettled, not all: the balance (on-chain RPC) and activity (our API) are
    // independent -- one being briefly down shouldn't blank out the other.
    const [balanceResult, historyResult] = await Promise.allSettled([
      getUsdcBalance(address),
      api.getHistory(address),
    ]);

    if (balanceResult.status === "fulfilled") setBalance(balanceResult.value);

    if (historyResult.status === "fulfilled") {
      const history = historyResult.value;
      const merged: ActivityRow[] = [
        ...history.sent.map((entry) => ({ ...entry, direction: "out" as const })),
        ...history.received.map((entry) => ({ ...entry, direction: "in" as const })),
      ].sort((a, b) => b.createdAt - a.createdAt);
      setActivity(merged);
    }

    const failure = balanceResult.status === "rejected" ? balanceResult.reason : historyResult.status === "rejected" ? historyResult.reason : null;
    setError(failure ? "Couldn't load everything." : null);
  }

  useEffect(() => {
    refresh()
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCancel(entry: ActivityRow) {
    if (entry.claimIdOnchain === null) return;

    // Session may have lapsed since the page loaded. Catch it here rather than
    // letting the ZeroDev reclaim call fail with a confusing error.
    if (!(await isLoggedIn())) {
      setSessionExpired(true);
      return;
    }

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
    <Screen withNav>
      <div className="flex flex-col items-center gap-3 py-6">
        <p className="text-sm text-zinc-400 dark:text-zinc-500">Balance</p>
        {loading ? (
          <div className="h-12 w-32 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-900" />
        ) : (
          <AmountDisplay value={formatUsdcAmount(balance ?? 0n)} />
        )}
        {!loading && (balance ?? 0n) < LOW_BALANCE && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 transition-transform active:scale-[0.98] dark:bg-zinc-900 dark:text-zinc-200"
          >
            <Plus size={16} weight="bold" />
            Add money
          </button>
        )}
      </div>

      <AddMoneySheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={refresh}
        onSessionExpired={() => setSessionExpired(true)}
      />

      {sessionExpired && (
        <div className="mb-4 flex items-center justify-between gap-2 text-sm text-red-600 dark:text-red-400">
          <span>Your session expired.</span>
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem("owo.returnTo", "/home");
              loginWithGoogle();
            }}
            className="font-medium underline"
          >
            Sign in again
          </button>
        </div>
      )}

      {error && !sessionExpired && (
        <div className="mb-4 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <WarningCircle size={18} weight="bold" />
          <span>{error}</span>
        </div>
      )}

      <h2 className="mb-2 text-sm font-medium text-zinc-400 dark:text-zinc-500">Activity</h2>

      {loading ? (
        <div className="flex flex-col gap-4 py-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-10 shrink-0 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-900" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-900" />
                <div className="h-3 w-16 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-900" />
              </div>
            </div>
          ))}
        </div>
      ) : activity.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <PaperPlaneTilt className="text-zinc-300 dark:text-zinc-700" size={36} />
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            No activity yet. Send your first payment.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {activity.map((entry) => (
            <li key={entry.linkId} className="flex items-center gap-3 py-4">
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                  entry.direction === "in"
                    ? "bg-accent/10 dark:bg-accent-dark/10"
                    : "bg-zinc-100 dark:bg-zinc-900"
                }`}
              >
                {entry.direction === "in" ? (
                  <ArrowDown className="text-accent dark:text-accent-dark" size={18} />
                ) : (
                  <ArrowUp className="text-zinc-500 dark:text-zinc-400" size={18} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {entry.note || (entry.direction === "in" ? "Received" : "Sent")}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {formatDate(entry.createdAt)}
                  </span>
                  <StatusPill status={entry.status} />
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {entry.direction === "in" ? "+" : "-"}${formatUsdcAmount(BigInt(entry.amount))}
                </span>
                {entry.direction === "out" && entry.status === "expired" && (
                  <button
                    type="button"
                    disabled={reclaimingId === entry.linkId}
                    onClick={() => handleCancel(entry)}
                    className="text-xs font-medium text-accent disabled:opacity-40 dark:text-accent-dark"
                  >
                    {reclaimingId === entry.linkId ? "Cancelling…" : "Cancel"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
