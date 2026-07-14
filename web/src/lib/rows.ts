import type { HistoryEntry } from "./api";

type Row = HistoryEntry & { direction: "in" | "out" };

// The counterparty line that distinguishes one payment from another. Received money
// shows who it's from; sent money shows who claimed it once claimed, and "Sent via
// link" while it's still out there (the link model has no recipient until claimed).
export function counterparty(entry: Row): string {
  if (entry.direction === "in") return `From ${entry.senderDisplay || "someone"}`;
  if (entry.status === "claimed" && entry.recipientDisplay) return `To ${entry.recipientDisplay}`;
  return "Sent via link";
}
