import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowDown,
  ArrowSquareOut,
  ArrowUp,
  ClockCounterClockwise,
  WarningCircle,
} from "@phosphor-icons/react";
import { api, type HistoryEntry } from "../lib/api";
import { formatMoney, formatUsdcDisplay, formatNairaFromUsdc } from "../lib/money";
import { counterparty } from "../lib/rows";
import { useCurrency } from "../lib/currency";
import { getSmartAccountAddress } from "../lib/zerodev";
import { Screen } from "../components/Screen";
import { StatusPill } from "../components/StatusPill";
import { CurrencyToggle } from "../components/CurrencyToggle";

const EXPLORER_TX = "https://sepolia.arbiscan.io/tx/";

type Txn = HistoryEntry & { direction: "in" | "out" };

function proofTx(entry: Txn): string | null {
  return entry.claimTx ?? entry.fundTx ?? entry.reclaimTx;
}

function fullDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// "Activity", not "Receipts": no chain vocabulary in the primary UI. The on-chain
// proof (Arbiscan) is deliberately one tap deeper, in a transaction's detail sheet,
// so the reveal is discovered rather than sitting in the tab bar.
export function Activity() {
  const reduceMotion = useReducedMotion();
  const { naira } = useCurrency();
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Txn | null>(null);

  useEffect(() => {
    getSmartAccountAddress()
      .then((address) => api.getHistory(address))
      .then((history) => {
        const merged: Txn[] = [
          ...history.sent.map((entry) => ({ ...entry, direction: "out" as const })),
          ...history.received.map((entry) => ({ ...entry, direction: "in" as const })),
        ].sort((a, b) => b.createdAt - a.createdAt);
        setTxns(merged);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen withNav>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">Activity</h1>
        <CurrencyToggle />
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-[1.25rem] bg-sand" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <WarningCircle className="text-faint" size={36} />
          <p className="text-sm text-muted">Couldn't load your activity.</p>
        </div>
      ) : txns.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <ClockCounterClockwise className="text-faint" size={36} />
          <p className="text-sm text-muted">Your payments will show up here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {txns.map((entry) => (
            <li key={entry.linkId}>
              <button
                type="button"
                onClick={() => setSelected(entry)}
                className="flex w-full items-center gap-3 rounded-2xl py-4 text-left transition-transform active:scale-[0.99]"
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
                    {entry.note && <span className="truncate text-xs text-faint">{entry.note}</span>}
                    {entry.direction === "out" && <StatusPill status={entry.status} />}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-ink">
                  {entry.direction === "in" ? "+" : "-"}
                  {formatMoney(BigInt(entry.amount), naira)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-20 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="absolute inset-0 bg-ink/40" onClick={() => setSelected(null)} />
            <motion.div
              className="relative w-full max-w-[430px] rounded-t-[2rem] bg-cream px-5 pb-8 pt-3"
              initial={reduceMotion ? false : { y: "100%" }}
              animate={{ y: 0 }}
              exit={reduceMotion ? undefined : { y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
            >
              <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-sanddeep" />

              <p className="text-center text-sm text-muted">{counterparty(selected)}</p>
              <p className="mt-1 text-center text-5xl font-semibold tabular-nums text-ink">
                {formatMoney(BigInt(selected.amount), naira)}
              </p>
              <p className="mt-1 text-center text-sm text-muted">
                {naira
                  ? `≈ $${formatUsdcDisplay(BigInt(selected.amount))}`
                  : `≈ ₦${formatNairaFromUsdc(BigInt(selected.amount))}`}
              </p>

              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted">Status</dt>
                  <dd>
                    {selected.direction === "in" ? (
                      <span className="text-sm font-medium text-accent">Received</span>
                    ) : (
                      <StatusPill status={selected.status} />
                    )}
                  </dd>
                </div>
                {selected.note && (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted">Note</dt>
                    <dd className="truncate text-ink">{selected.note}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <dt className="text-muted">Date</dt>
                  <dd className="text-ink">{fullDate(selected.createdAt)}</dd>
                </div>
              </dl>

              {proofTx(selected) && (
                <a
                  href={`${EXPLORER_TX}${proofTx(selected)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 flex items-center justify-center gap-1.5 rounded-full bg-sand py-3 text-sm font-medium text-muted"
                >
                  View on Arbiscan
                  <ArrowSquareOut size={16} weight="bold" />
                </a>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Screen>
  );
}
