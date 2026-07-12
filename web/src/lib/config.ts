function required(name: string): string {
  const value = import.meta.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  arbitrumSepoliaRpc: () => required("VITE_ARBITRUM_SEPOLIA_RPC"),
  escrowAddress: () => required("VITE_ESCROW_ADDRESS") as `0x${string}`,
  usdcAddress: () => required("VITE_USDC_ADDRESS") as `0x${string}`,
  zerodevProjectId: () => required("VITE_ZERODEV_PROJECT_ID"),
  apiBase: import.meta.env.VITE_API_BASE ?? "http://localhost:3001",
};
