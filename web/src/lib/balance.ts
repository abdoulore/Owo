import { createPublicClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { config } from "./config";
import { usdcAbi } from "../abi/usdc";

export async function getUsdcBalance(address: `0x${string}`): Promise<bigint> {
  const client = createPublicClient({ chain: arbitrumSepolia, transport: http(config.arbitrumSepoliaRpc()) });
  return client.readContract({
    address: config.usdcAddress(),
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [address],
  });
}
