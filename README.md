# Owó

Send money like a message. A mobile-first web app for peer-to-peer USDC transfer on Arbitrum, wrapped so neither sender nor recipient ever sees a wallet, gas fee, or chain name.

Built for the [UXmaxx Hackathon](https://www.encodeclub.com/programmes/uxmaxx-hackathon).

## How it works

1. Sender logs in with Google, enters an amount, gets a shareable link.
2. Recipient opens the link, logs in with their own Google account, taps Claim.
3. Funds move on Arbitrum via a smart contract escrow. A relayer sponsors all gas.

The claim secret lives only in the URL fragment (after `#`), generated client-side. It is never sent to or stored on the server, except transiently when the recipient submits a claim.

**Security model**: possession of the link is the authorization, like a check made out to cash. `claim()` lets the secret-holder pick the recipient by design. Revealing the secret on-chain cannot be front-run on Arbitrum (sequencer ordering, no public mempool), and only the app's relayer submits claims. The contract rejects zero amounts and the hash of an empty secret, so a client bug cannot mint claimable-by-anyone links.

**Crash recovery**: claim secrets are never written to disk, so a relayer restart mid-claim cannot replay the transaction from the queue. Recovery is client-driven instead: the recipient taps Claim again, which is safe because the contract's Pending check makes resubmission idempotent. Funding is crash-proof on the other side too — if the sender's browser dies after the on-chain send but before notifying the API, the indexer independently matches the `Sent` event by claim hash and marks the link funded.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  web/       │────▶│  api/            │────▶│  Arbitrum        │
│  Vite+React │     │  Express + TS    │     │  RemitEscrow.sol │
│  Magic SDK  │     │  SQLite          │     │  USDC            │
└─────────────┘     │  Relayer         │     └──────────────────┘
                    │  Indexer         │
                    └──────────────────┘
```

- **contracts/** — Foundry project. `RemitEscrow.sol` locks USDC against a `keccak256(secret)` hash; `MockUSDC.sol` is a mintable 6-decimal testnet stand-in.
- **api/** — Express + TypeScript (ESM), better-sqlite3, viem. Link metadata, sponsored relayer, on-chain event indexer.
- **web/** — Vite + React + TypeScript. Magic SDK for Google login. Payment-app UX, zero crypto vocabulary.

## Track decision

**Decided: Variant B — ZeroDev smart accounts + sponsored paymaster.** Skipped the Particle UA spike: the Universal Accounts prize delta didn't justify the time against a 10-day-to-milestone schedule, and ZeroDev already delivers genuine account abstraction (the theme this hackathon judges on) without it. Targets General track + Arbitrum bounty + Magic bounty.

`send()` and `reclaim()` both require `msg.sender` to be the user's own identity (fund pull, sender check), so they're submitted directly from the frontend as sponsored UserOperations through a ZeroDev Kernel account (owner = the Magic-derived key), while the user is present. `claim()` has no such restriction — recipient is an explicit parameter — so it's the one call the backend relayer submits directly, sponsored, on the recipient's behalf.

**Two gotchas hit during setup, in case they resurface:**
- ZeroDev refuses to sponsor anything until a **Gas Policy** exists on the project dashboard (Project Policy → Sponsor All, scoped to Arbitrum Sepolia). No default policy is created automatically — this is a deliberate anti-abuse default, not a bug.
- `@zerodev/sdk`'s `KernelEIP1193Provider` extends Node's `EventEmitter`, which Vite externalizes instead of polyfilling in the browser, crashing with `Class extends value undefined is not a constructor or null`. Fixed via `vite-plugin-node-polyfills` scoped to just `events` in `vite.config.ts`.

## Setup

Requires Node 20+, [Foundry](https://book.getfoundry.sh/getting-started/installation).

Each package reads its own `.env` — Foundry and Vite only look in their own directory, so there's no single shared env file across the three. The root `.env.example` is a full reference of every key used anywhere in the stack; each package's own `.env.example` is the subset that package actually reads.

```bash
# Contracts
cd contracts
forge install
forge test
cp .env.example .env      # fill in RELAYER_PRIVATE_KEY, ARBITRUM_SEPOLIA_RPC, ARBISCAN_API_KEY

# API
cd ../api
npm install
cp .env.example .env      # fill in the same RELAYER_PRIVATE_KEY/RPC, plus ESCROW_ADDRESS/USDC_ADDRESS after deploy
npm run dev

# Web
cd ../web
npm install
cp .env.example .env      # fill in VITE_MAGIC_PUBLISHABLE_KEY, VITE_ZERODEV_PROJECT_ID, chain config
npm run dev
```

## Deploying the contract

```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url arbitrum_sepolia --broadcast --verify
```

Deployed and verified on Arbitrum Sepolia:

- `RemitEscrow`: [`0x00d218141984B2e030CDBaA30C86916AD0633e29`](https://sepolia.arbiscan.io/address/0x00d218141984B2e030CDBaA30C86916AD0633e29)
- `MockUSDC`: [`0xd888A21708fCe03889B5275544831fb2179E6d9a`](https://sepolia.arbiscan.io/address/0xd888A21708fCe03889B5275544831fb2179E6d9a)

## Status

- [x] Phase 0: monorepo scaffolded, contracts skeleton, API skeleton, web skeleton with routing
- [x] Phase 0: track decided (Variant B, ZeroDev — see above), Particle spike skipped
- [x] Phase 0: Magic Google login working end-to-end (verified live: real Google account → smart account provisioned)
- [x] Phase 1: RemitEscrow + MockUSDC written, full Foundry test suite green (14 tests, including fuzz)
- [x] Phase 1: deployed + verified on Arbitrum Sepolia (addresses above)
- [x] Phase 2: links/claims/reclaims/history endpoints, relayer (nonce-managed, gas-bump retry), indexer (cursor + backfill, paced catch-up loop) — verified end-to-end against both a local Anvil chain and live Arbitrum Sepolia
- [x] Phase 2: ZeroDev integration for send()/reclaim() — Kernel account (Magic signer as owner), batched approve+send, reclaim, wired into Send/Home. **Verified live end-to-end**: real Google login → real sponsored UserOperation through ZeroDev's paymaster → on-chain send confirmed by independent verification → shareable link → relayer-submitted claim → real USDC payout, all cross-checked against on-chain balances
- [ ] Phase 3: frontend screens built and polished
- [ ] Phase 4: cross-chain claim (Variant A only)
- [ ] Phase 5: hardening, edge cases, copy pass
- [ ] Phase 6: demo video, submission

## What this is not

No fiat on/off-ramps (mock only), no KYC, no multi-currency beyond USDC (NGN is a display-only conversion), no native mobile apps, no group payments or recurring transfers.
