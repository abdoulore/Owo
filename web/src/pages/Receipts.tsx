import { useEffect, useState } from "react";
import { ArrowSquareOut, Receipt as ReceiptIcon, WarningCircle } from "@phosphor-icons/react";
import { api, type HistoryEntry } from "../lib/api";
import { formatUsdcAmount } from "../lib/money";
import { getSmartAccountAddress } from "../lib/zerodev";
import { Screen } from "../components/Screen";
import { StatusPill } from "../components/StatusPill";

const EXPLORER_TX = "https://sepolia.arbiscan.io/tx/";

type Receipt = HistoryEntry & { direction: "in" | "out" };

function txHash(entry: Receipt): string | null {
  return entry.claimTx ?? entry.fundTx ?? entry.reclaimTx;
}

// Every transfer's on-chain proof, one tap from Home. This is the "reveal"
// screen: the moment that shows the whole thing actually settled on Arbitrum.
export function Receipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSmartAccountAddress()
      .then((address) => api.getHistory(address))
      .then((history) => {
        const merged: Receipt[] = [
          ...history.sent.map((entry) => ({ ...entry, direction: "out" as const })),
          ...history.received.map((entry) => ({ ...entry, direction: "in" as const })),
        ].sort((a, b) => b.createdAt - a.createdAt);
        setReceipts(merged);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen withNav>
      <h1 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-50">Receipts</h1>

      {loading ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-[1.25rem] bg-zinc-100 dark:bg-zinc-900" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <WarningCircle className="text-zinc-400 dark:text-zinc-500" size={36} />
          <p className="text-sm text-zinc-400 dark:text-zinc-500">Couldn't load your receipts.</p>
        </div>
      ) : receipts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <ReceiptIcon className="text-zinc-300 dark:text-zinc-700" size={36} />
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            Receipts show up here once a transfer settles on-chain.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {receipts.map((entry) => {
            const hash = txHash(entry);
            return (
              <li key={entry.linkId} className="flex items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {entry.direction === "in" ? "Received" : "Sent"} $
                    {formatUsdcAmount(BigInt(entry.amount))}
                  </p>
                  <StatusPill status={entry.status} />
                </div>
                {hash ? (
                  <a
                    href={`${EXPLORER_TX}${hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex shrink-0 items-center gap-1 text-sm font-medium text-accent dark:text-accent-dark"
                  >
                    Arbiscan
                    <ArrowSquareOut size={16} weight="bold" />
                  </a>
                ) : (
                  <span className="shrink-0 text-sm text-zinc-300 dark:text-zinc-700">
                    Pending
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
