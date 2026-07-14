// Labels for an OUTGOING payment's lifecycle, from the sender's point of view. Never
// the internal state names: "funded" means nothing to a person, "Waiting to be claimed"
// does. Incoming payments have no lifecycle to show (they're already received), so
// callers render this only for outgoing rows.
const LABELS: Record<string, string> = {
  created: "Sending…",
  funded: "Waiting to be claimed",
  claimed: "Claimed",
  reclaimed: "Cancelled",
  expired: "Expired",
};

const TONES: Record<string, string> = {
  created: "text-muted",
  funded: "text-amber-700",
  claimed: "text-accent",
  reclaimed: "text-faint",
  expired: "text-faint",
};

export function StatusPill({ status }: { status: string }) {
  const pulse = status === "created" ? "animate-pulse" : "";
  return (
    <span className={`text-sm font-medium ${TONES[status] ?? "text-muted"} ${pulse}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
