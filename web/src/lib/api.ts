const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface LinkMetadata {
  amount: string;
  note: string | null;
  senderDisplay: string | null;
  sender: string;
  status: "created" | "funded" | "claimed" | "reclaimed" | "expired";
}

export interface HistoryEntry {
  linkId: string;
  amount: string;
  note: string | null;
  status: string;
  senderDisplay: string | null;
  recipientDisplay: string | null;
  claimIdOnchain: number | null;
  createdAt: number;
  fundTx: string | null;
  claimTx: string | null;
  reclaimTx: string | null;
}

export const api = {
  createLink: (body: {
    amount: string;
    note?: string;
    senderAddress: string;
    senderDisplay?: string;
    claimHash: string;
  }) => request<{ linkId: string; expiry: number }>("/links", { method: "POST", body: JSON.stringify(body) }),

  markFunded: (linkId: string, body: { claimIdOnchain: number; fundTx: string }) =>
    request<{ status: string }>(`/links/${linkId}/funded`, { method: "POST", body: JSON.stringify(body) }),

  getLink: (id: string) => request<LinkMetadata>(`/links/${id}`),

  claim: (body: { linkId: string; recipient: string; secret: string; recipientDisplay?: string }) =>
    request<{ status: string; txHash: string }>("/claims", { method: "POST", body: JSON.stringify(body) }),

  markReclaimed: (body: { linkId: string; reclaimTx: string }) =>
    request<{ status: string }>("/reclaims", { method: "POST", body: JSON.stringify(body) }),

  getHistory: (address: string) =>
    request<{ sent: HistoryEntry[]; received: HistoryEntry[]; pending: HistoryEntry[] }>(
      `/history/${address}`
    ),

  faucet: (address: string) =>
    request<{ funded: boolean; txHash: string | null }>("/faucet", {
      method: "POST",
      body: JSON.stringify({ address }),
    }),
};
