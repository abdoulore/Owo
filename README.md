# Owó

Send money like a message. A mobile-first web app for peer-to-peer USDC transfer on Arbitrum, wrapped so neither sender nor recipient ever sees a wallet, gas fee, or chain name.

Built for the [UXmaxx Hackathon](https://www.encodeclub.com/programmes/uxmaxx-hackathon).

## How it works

1. Sender logs in with Google, enters an amount, gets a shareable link.
2. Recipient opens the link, logs in with their own Google account, taps Claim.
3. Funds move on Arbitrum via a smart contract escrow. A relayer sponsors all gas.

The claim secret lives only in the URL fragment (after `#`), generated client-side. It is never sent to or stored on the server, except transiently when the recipient submits a claim.

**Security model**: possession of the link is the authorization, like a check made out to cash. `claim()` lets the secret-holder pick the recipient by design. Revealing the secret on-chain cannot be front-run on Arbitrum (sequencer ordering, no public mempool), and only the app's relayer submits claims. The contract rejects zero amounts and the hash of an empty secret, so a client bug cannot mint claimable-by-anyone links.

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

**Status: pending.** Phase 0 includes a 2-day timeboxed spike on Particle Universal Accounts (EIP-7702 mode). Outcome will be recorded here:

- **Variant A (Particle UA, EIP-7702)** — if the spike passes cleanly. Targets the Universal Accounts prize track.
- **Variant B (ZeroDev smart accounts + sponsored paymaster)** — default fallback if the spike fights back. Targets the General track + Arbitrum bounty + Magic bounty.

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
- [ ] Phase 0: Particle spike run, track decided
- [ ] Phase 0: Magic Google login working end-to-end
- [x] Phase 1: RemitEscrow + MockUSDC written, full Foundry test suite green (14 tests, including fuzz)
- [ ] Phase 1: deployed + verified on Arbitrum Sepolia
- [ ] Phase 2: backend endpoints, relayer, indexer wired end-to-end
- [ ] Phase 3: frontend screens built and polished
- [ ] Phase 4: cross-chain claim (Variant A only)
- [ ] Phase 5: hardening, edge cases, copy pass
- [ ] Phase 6: demo video, submission

## What this is not

No fiat on/off-ramps (mock only), no KYC, no multi-currency beyond USDC (NGN is a display-only conversion), no native mobile apps, no group payments or recurring transfers.
