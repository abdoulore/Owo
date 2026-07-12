const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

// TODO(Phase 2): flesh out with the real request/response shapes as endpoints land.
export const api = {
  createLink: (body: { amount: string; note?: string; senderAddress: string; claimHash: string }) =>
    request("/links", { method: "POST", body: JSON.stringify(body) }),
  getLink: (id: string) => request(`/links/${id}`),
  claim: (body: { linkId: string; recipient: string; secret: string }) =>
    request("/claims", { method: "POST", body: JSON.stringify(body) }),
  getHistory: (address: string) => request(`/history/${address}`),
};
