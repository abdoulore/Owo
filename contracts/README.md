# contracts

Foundry project for Owó's on-chain layer.

- `src/RemitEscrow.sol` — locks USDC against `keccak256(secret)`; claim with the secret, reclaim after expiry.
- `src/MockUSDC.sol` — mintable 6-decimal testnet stand-in for USDC.
- `test/RemitEscrow.t.sol` — full suite including fuzz; run with `forge test`.
- `script/Deploy.s.sol` — deploys to Arbitrum Sepolia; see root README for the command.
