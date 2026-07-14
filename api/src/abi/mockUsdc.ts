// Minimal MockUSDC ABI: the mint() used by the test-money faucet and balanceOf()
// to guard against over-minting. MockUSDC.mint is intentionally unrestricted (it
// is a testnet stand-in), so the relayer can mint on a user's behalf.
export const mockUsdcAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
