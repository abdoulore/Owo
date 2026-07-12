import { createWalletClient, createPublicClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY as Hex | undefined;
const ARBITRUM_SEPOLIA_RPC = process.env.ARBITRUM_SEPOLIA_RPC;

// TODO(Phase 2): serial queue with nonce management, persisted to `relayer_queue`
// so a restart doesn't drop pending txs. Retry with gas bump, max 3 retries.
// Log every submission with claimId + txHash.

export function getRelayerAccount() {
  if (!RELAYER_PRIVATE_KEY) throw new Error("RELAYER_PRIVATE_KEY not set");
  return privateKeyToAccount(RELAYER_PRIVATE_KEY);
}

export function getPublicClient() {
  return createPublicClient({
    chain: arbitrumSepolia,
    transport: http(ARBITRUM_SEPOLIA_RPC),
  });
}

export function getWalletClient() {
  return createWalletClient({
    account: getRelayerAccount(),
    chain: arbitrumSepolia,
    transport: http(ARBITRUM_SEPOLIA_RPC),
  });
}

export async function getRelayerHealth() {
  const account = getRelayerAccount();
  const publicClient = getPublicClient();
  const balance = await publicClient.getBalance({ address: account.address });
  return {
    address: account.address,
    balance: balance.toString(),
    queueDepth: 0, // TODO(Phase 2): read pending count from relayer_queue
  };
}
