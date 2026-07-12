// Hand-authored to match contracts/src/RemitEscrow.sol exactly. Keep in sync manually;
// there is no build step wiring the two packages together for a hackathon timeline.
// Only the calls the frontend itself submits (send, reclaim) are included —
// claim() is submitted by the backend relayer, not from here.
export const remitEscrowAbi = [
  {
    type: "function",
    name: "send",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "claimHash", type: "bytes32" },
      { name: "expiry", type: "uint256" },
    ],
    outputs: [{ name: "claimId", type: "uint256" }],
  },
  {
    type: "function",
    name: "reclaim",
    stateMutability: "nonpayable",
    inputs: [{ name: "claimId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "event",
    name: "Sent",
    inputs: [
      { name: "claimId", type: "uint256", indexed: true },
      { name: "sender", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "claimHash", type: "bytes32", indexed: false },
      { name: "expiry", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;
