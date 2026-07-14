import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowUp, PaperPlaneTilt, Plus, WarningCircle } from "@phosphor-icons/react";
import { api, type HistoryEntry } from "../lib/api";
import { formatMoney } from "../lib/money";
import { counterparty } from "../lib/rows";
import { useCurrency } from "../lib/currency";
import { getSmartAccountAddress, reclaimPayment } from "../lib/zerodev";
import { getUsdcBalance } from "../lib/balance";
import { getUserEmail, isLoggedIn, loginWithGoogle } from "../lib/magic";
import { displayNameFromEmail } from "../lib/identity";
import { Screen } from "../components/Screen";
import { StatusPill } from "../components/StatusPill";
import { Avatar } from "../components/Avatar";
import { AddMoneySheet } from "../components/AddMoneySheet";

type ActivityRow = HistoryEntry & { direction: "in" | "out" };

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function Home() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { naira, setNaira } = useCurrency();
  const [name, setName] = useState("there");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reclaimingId, setReclaimingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  async function refresh() {
    const [address, email] = await Promise.all([getSmartAccountAddress(), getUserEmail()]);
    setName(displayNameFromEmail(email));
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

    const failure =
      balanceResult.status === "rejected"
        ? balanceResult.reason
        : historyResult.status === "rejected"
          ? historyResult.reason
          : null;
    setError(failure ? "Couldn't load everything." : null);
  }

  useEffect(() => {
    refresh()
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCancel(entry: ActivityRow) {
    if (entry.claimIdOnchain === null) return;
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

  const bal = balance ?? 0n;

  return (
    <Screen withNav>
      <header className="flex items-center justify-between pb-2">
        <div>
          <p className="text-sm text-muted">Welcome back</p>
          <p className="text-xl font-semibold text-ink">Hi, {name}</p>
        </div>
        <Avatar name={name} size={44} />
      </header>

      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="my-4 rounded-[1.5rem] bg-accent px-6 py-7 text-white shadow-lg shadow-accent/20"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/80">Balance</p>
          <div className="flex rounded-full bg-white/15 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setNaira(false)}
              className={`rounded-full px-2.5 py-1 ${naira ? "text-white/70" : "bg-white/90 text-accent"}`}
            >
              $
            </button>
            <button
              type="button"
              onClick={() => setNaira(true)}
              className={`rounded-full px-2.5 py-1 ${naira ? "bg-white/90 text-accent" : "text-white/70"}`}
            >
              ₦
            </button>
          </div>
        </div>
        {loading ? (
          <div className="mt-2 h-11 w-40 animate-pulse rounded-full bg-white/20" />
        ) : (
          <p className="mt-1 text-5xl font-semibold tabular-nums">{formatMoney(bal, naira)}</p>
        )}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => navigate("/send")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white py-2.5 text-sm font-medium text-accent transition-transform active:scale-[0.98]"
          >
            <PaperPlaneTilt size={16} weight="bold" />
            Send
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/15 py-2.5 text-sm font-medium text-white transition-transform active:scale-[0.98]"
          >
            <Plus size={16} weight="bold" />
            Add money
          </button>
        </div>
      </motion.section>

      <AddMoneySheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={refresh}
        onSessionExpired={() => setSessionExpired(true)}
      />

      {sessionExpired && (
        <div className="mb-4 flex items-center justify-between gap-2 text-sm text-red-600">
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
        <div className="mb-4 flex items-center gap-2 text-sm text-red-600">
          <WarningCircle size={18} weight="bold" />
          <span>{error}</span>
        </div>
      )}

      <h2 className="mb-1 mt-2 text-sm font-medium text-muted">Activity</h2>

      {loading ? (
        <div className="flex flex-col gap-4 py-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-10 shrink-0 animate-pulse rounded-full bg-sand" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 animate-pulse rounded-full bg-sand" />
                <div className="h-3 w-16 animate-pulse rounded-full bg-sand" />
              </div>
            </div>
          ))}
        </div>
      ) : activity.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
          <PaperPlaneTilt className="text-faint" size={36} />
          <p className="text-sm text-muted">Your payments will show up here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {activity.map((entry, i) => (
            <motion.li
              key={entry.linkId}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.35 }}
              className="flex items-center gap-3 py-4"
            >
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                  entry.direction === "in" ? "bg-accent-soft" : "bg-sand"
                }`}
              >
                {entry.direction === "in" ? (
                  <ArrowDown className="text-accent" size={18} />
                ) : (
                  <ArrowUp className="text-muted" size={18} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{counterparty(entry)}</p>
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs text-faint">
                    {entry.note || formatDate(entry.createdAt)}
                  </span>
                  {entry.direction === "out" && <StatusPill status={entry.status} />}
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-medium tabular-nums text-ink">
                  {entry.direction === "in" ? "+" : "-"}
                  {formatMoney(BigInt(entry.amount), naira)}
                </span>
                {entry.direction === "out" && entry.status === "expired" && (
                  <button
                    type="button"
                    disabled={reclaimingId === entry.linkId}
                    onClick={() => handleCancel(entry)}
                    className="text-xs font-medium text-accent disabled:opacity-40"
                  >
                    {reclaimingId === entry.linkId ? "Cancelling…" : "Cancel"}
                  </button>
                )}
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
