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

`send()` and `reclaim()` both require `msg.sender` to be the user's own identity (fund pull, sender check), so they're submitted directly from the frontend as sponsored UserOperations through a ZeroDev Kernel account (owner = the Magic-derived key), while the user is present. `claim()` has no such restriction — recipient is an explicit parameter — so it's the one call the backend relayer submits directly, sponsored, on the recipient's behalf. ZeroDev integration is the next piece of work, not yet started.

## Setup

Requires Node 20+, [Foundry](https://book.getfoundry.sh/getting-started/installation).

```bash
# Contracts
cd contracts
forge install
forge test

# API
cd ../api
npm install
cp ../.env.example .env   # fill in RELAYER_PRIVATE_KEY, RPC URL, etc.
npm run dev

# Web
cd ../web
npm install
cp .env.example .env      # fill in VITE_MAGIC_PUBLISHABLE_KEY
npm run dev
```

## Deploying the contract

```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url arbitrum_sepolia --broadcast --verify
```

Deployed addresses (filled in after Phase 1):

- `RemitEscrow`: _pending_
- `MockUSDC` (if used): _pending_

## Status

- [x] Phase 0: monorepo scaffolded, contracts skeleton, API skeleton, web skeleton with routing
- [x] Phase 0: track decided (Variant B, ZeroDev — see above), Particle spike skipped
- [ ] Phase 0: Magic Google login working end-to-end (OAuth callback wired, needs a real publishable key to verify)
- [x] Phase 1: RemitEscrow + MockUSDC written, full Foundry test suite green (14 tests, including fuzz)
- [ ] Phase 1: deployed + verified on Arbitrum Sepolia
- [x] Phase 2: links/claims/reclaims/history endpoints, relayer (nonce-managed, gas-bump retry), indexer (cursor + backfill) — verified end-to-end against a local Anvil chain: send → fund-verify → claim → indexer status flip → reclaim-verify, all matching on-chain state
- [~] Phase 2: ZeroDev integration for send()/reclaim() — Kernel account (Magic signer as owner), batched approve+send, reclaim, wired into Send/Home. ECDSA validator derivation confirmed against a real chain; full account creation + sponsored UserOp submission NOT yet verified — needs a real `VITE_ZERODEV_PROJECT_ID` and a publicly reachable RPC (a bare local Anvil lacks the ERC-4337 EntryPoint singleton, and ZeroDev's hosted bundler can't reach localhost anyway)
- [ ] Phase 3: frontend screens built and polished
- [ ] Phase 4: cross-chain claim (Variant A only)
- [ ] Phase 5: hardening, edge cases, copy pass
- [ ] Phase 6: demo video, submission

## What this is not

No fiat on/off-ramps (mock only), no KYC, no multi-currency beyond USDC (NGN is a display-only conversion), no native mobile apps, no group payments or recurring transfers.
