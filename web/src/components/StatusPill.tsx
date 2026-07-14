const LABELS: Record<string, string> = {
  created: "Setting up",
  funded: "Pending",
  claimed: "Claimed",
  reclaimed: "Cancelled",
  expired: "Expired",
};

const TONES: Record<string, string> = {
  created: "text-zinc-500 dark:text-zinc-400",
  funded: "text-amber-600 dark:text-amber-400",
  claimed: "text-accent dark:text-accent-dark",
  reclaimed: "text-zinc-400 dark:text-zinc-500",
  expired: "text-zinc-400 dark:text-zinc-500",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`text-sm font-medium ${TONES[status] ?? "text-zinc-500"}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
