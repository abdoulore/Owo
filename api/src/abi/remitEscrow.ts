// Hand-authored to match contracts/src/RemitEscrow.sol exactly. Keep in sync manually;
// there is no build step wiring the two packages together for a hackathon timeline.
export const remitEscrowAbi = [
  {
    type: "function",
    name: "transfers",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "sender", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "claimHash", type: "bytes32" },
      { name: "expiry", type: "uint256" },
      { name: "status", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "claimId", type: "uint256" },
      { name: "secret", type: "bytes" },
      { name: "recipient", type: "address" },
    ],
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
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "claimId", type: "uint256", indexed: true },
      { name: "recipient", type: "address", indexed: true },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Reclaimed",
    inputs: [{ name: "claimId", type: "uint256", indexed: true }],
    anonymous: false,
  },
] as const;

export const TransferStatus = {
  Pending: 0,
  Claimed: 1,
  Reclaimed: 2,
} as const;
