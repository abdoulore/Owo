export interface LinkRow {
  id: string;
  claim_hash: string;
  claim_id_onchain: number | null;
  amount: string;
  note: string | null;
  sender: string;
  sender_display: string | null;
  recipient: string | null;
  recipient_display: string | null;
  claim_locked_to: string | null;
  status: string;
  fund_tx: string | null;
  claim_tx: string | null;
  reclaim_tx: string | null;
  expiry: number | null;
  created_at: number;
}

// 'expired' is derived at read time rather than persisted, so no cron job is needed
// just to flip a status column once an unclaimed link's deadline passes.
export function derivedStatus(row: LinkRow): string {
  const isPending = row.status === "created" || row.status === "funded";
  if (isPending && row.expiry !== null && Date.now() >= row.expiry * 1000) {
    return "expired";
  }
  return row.status;
}
