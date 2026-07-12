function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  arbitrumSepoliaRpc: () => required("ARBITRUM_SEPOLIA_RPC"),
  escrowAddress: () => required("ESCROW_ADDRESS") as `0x${string}`,
  usdcAddress: () => required("USDC_ADDRESS") as `0x${string}`,
  relayerPrivateKey: () => required("RELAYER_PRIVATE_KEY") as `0x${string}`,
  apiPort: process.env.API_PORT ?? "3001",
  databasePath: process.env.DATABASE_PATH ?? "./owo.db",
};

export const DEFAULT_EXPIRY_SECONDS = 72 * 60 * 60;
