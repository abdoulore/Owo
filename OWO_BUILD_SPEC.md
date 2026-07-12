# OWÓ — Build Specification for Claude Code Agent

You are building **Owó** (Yoruba for "money"), a hackathon submission for the UXmaxx Hackathon. This document is your complete brief: context, architecture, implementation plan, rules, and constraints. Read it fully before writing any code.

---

## 1. HACKATHON CONTEXT

**Event**: UXmaxx Hackathon
**Organizer**: Encode Club, led by Particle Network (7702 Collective)
**Dates**: Started June 22, 2026. ~6 weeks, submission target ~August 2, 2026. Mid-hackathon milestone ~July 22, 2026.
**Format**: 100% online, advanced level.
**Signup**: https://www.encodeclub.com/programmes/uxmaxx-hackathon
**Community**: luma.com/95lt9lx4

**Core theme**: "Crypto has the infrastructure. It just doesn't use it." Build Web3 apps that feel like regular consumer products. Users must never deal with chains, gas, seed phrases, or wallets. Judged primarily on **UX polish and invisibility of infrastructure**, not infra cleverness.

**Partners / tech stack**:
- **Particle Network** — Universal Accounts + EIP-7702 (one account/balance across chains)
- **Arbitrum** — execution/settlement layer
- **Magic** — embedded wallets and social login
- **ZeroDev** and **Openfort** — account abstraction tooling

**Prizes**:
- Universal Accounts Track (requires Particle UA SDK in EIP-7702 mode + cross-chain ops): $2,500 / $2,000 / $1,500
- General Track (any strong UX-focused Web3 app): $2,000 / $1,200 / $800
- Arbitrum "Road to Open House London" bounty: $2,000 (best app using Arbitrum)
- Magic Labs bounty: $500 (best embedded wallet integration)
- Smaller ZeroDev/Openfort sub-bounties

**Our prize strategy**: Primary target is General Track + Arbitrum bounty + Magic bounty (stackable, ~$4.5K ceiling). The UA Track is conditional on a time-boxed Particle SDK spike (see Phase 0). If the spike passes, submit UA Track instead of General.

---

## 2. WHAT WE ARE BUILDING

**One-liner**: Send money like a WhatsApp message.

**Product**: A mobile-first web app for peer-to-peer money transfer (remittance-shaped). The sender logs in with Google, enters an amount, gets a shareable claim link. The recipient opens the link, logs in with their own Google account, taps Claim, and the money is theirs. USDC on Arbitrum under the hood. Neither party ever sees a wallet address, seed phrase, gas fee, or chain name.

**Narrative for judges**: Remittance corridors (e.g. diaspora → Nigeria) are expensive and high-friction. Owó makes sending money as easy as sharing a link, with all crypto infrastructure invisible. The demo money shot: two phones side by side, sender to claimed funds in under 60 seconds, then reveal the on-chain receipts.

**What this is NOT** (scope guard — do not build):
- No fiat on/off-ramps (stub/mock only, label clearly)
- No KYC
- No multi-currency beyond USDC (NGN display toggle is display-only conversion)
- No mobile native apps — mobile-first responsive web only
- No group payments, no requests, no recurring payments

---

## 3. ARCHITECTURE

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  web/       │────▶│  api/            │────▶│  Arbitrum        │
│  Vite+React │     │  Express + TS    │     │  RemitEscrow.sol │
│  Magic SDK  │     │  SQLite          │     │  USDC            │
└─────────────┘     │  Relayer         │     └──────────────────┘
                    │  Indexer         │
                    └──────────────────┘
```

**Components**:
1. **Auth/wallets**: Magic SDK, Google social login. Magic silently provisions an embedded wallet per user. The user never sees it.
2. **Accounts**:
   - Variant A (if Particle spike passes): Particle Universal Accounts in EIP-7702 mode.
   - Variant B (default fallback): ZeroDev smart accounts on Arbitrum with sponsored gas via paymaster.
3. **Chain**: Arbitrum Sepolia for development; final deploy target decided at submission (Sepolia acceptable if judging norms allow, check hackathon rules).
4. **Asset**: USDC (testnet USDC on Arbitrum Sepolia; deploy a mintable MockUSDC if faucet friction is high — 6 decimals, mimic real USDC).
5. **Claim mechanism**: `RemitEscrow` contract. Funds locked against `keccak256(secret)`. Secret is embedded in the link URL fragment (never sent to or stored on the server).
6. **Gas**: A funded relayer wallet sponsors all transactions for both sender and recipient. Users never see gas.
7. **Backend**: Express + TypeScript, **ESM throughout** (no CJS — CJS builds have broken this stack before), SQLite for link metadata and claim status.
8. **Frontend**: Vite + React + TypeScript. Mobile-first. Payment-app aesthetic (Cash App / Opay warmth), NOT a dapp aesthetic, NOT a terminal aesthetic.

---

## 4. REPOSITORY STRUCTURE

Monorepo:

```
owo/
├── contracts/          # Foundry project
│   ├── src/RemitEscrow.sol
│   ├── src/MockUSDC.sol
│   ├── test/RemitEscrow.t.sol
│   └── script/Deploy.s.sol
├── api/                # Express + TS (ESM), SQLite
│   ├── src/index.ts
│   ├── src/routes/     # links, claims, history
│   ├── src/relayer.ts  # sponsored tx submission, queue, nonce mgmt
│   ├── src/indexer.ts  # escrow event watcher → SQLite status updates
│   └── src/db.ts
├── web/                # Vite + React + TS
│   ├── src/pages/      # Send, Claim, Home/History, Receipts
│   ├── src/lib/magic.ts
│   └── src/lib/api.ts
├── .env.example        # every secret/config key documented
└── README.md           # setup, run, demo script, architecture
```

---

## 5. SMART CONTRACT SPEC — RemitEscrow.sol

Solidity ^0.8.24, Foundry.

**State**: mapping of `claimId => Transfer { sender, token, amount, claimHash, expiry, status }`

**Functions**:
- `send(address token, uint256 amount, bytes32 claimHash, uint256 expiry) returns (uint256 claimId)`
  - Pulls USDC via `transferFrom`, locks against `claimHash`
  - Expiry default 72 hours, enforce `expiry > block.timestamp`
  - Emits `Sent(claimId, sender, token, amount, claimHash, expiry)`
- `claim(uint256 claimId, bytes calldata secret, address recipient)`
  - Requires `keccak256(secret) == claimHash`, status == Pending, `block.timestamp < expiry`
  - Transfers to `recipient`, marks Claimed
  - Emits `Claimed(claimId, recipient)`
  - Callable by the relayer on behalf of the recipient (recipient address passed in; the secret is the authorization)
- `reclaim(uint256 claimId)`
  - Only original sender, only after expiry, only if Pending
  - Returns funds, marks Reclaimed, emits `Reclaimed(claimId)`

**Security requirements**:
- Checks-effects-interactions, reentrancy guard on claim/reclaim
- No double claim, no claim after reclaim, no reclaim after claim
- Use SafeERC20

**Foundry tests (must pass before anything is built on top — this is a hard gate)**:
- Happy path send → claim
- Wrong secret reverts
- Double claim reverts
- Claim after expiry reverts
- Reclaim before expiry reverts, after expiry succeeds
- Reclaim by non-sender reverts
- Fuzz test on secret/hash matching

Deploy to Arbitrum Sepolia via `script/Deploy.s.sol`, verify on Arbiscan.

---

## 6. BACKEND SPEC — api/

**Stack**: Node 20+, Express, TypeScript, ESM (set `"type": "module"`, use `tsx` for dev), better-sqlite3, ethers v6 (or viem — pick one, use it everywhere).

**Endpoints**:
- `POST /links` — body: `{ amount, note?, senderAddress }`. Server generates nothing secret-related; the CLIENT generates the secret and sends only `claimHash`. Server stores `{ claimHash, amount, note, senderAddress, status: 'created' }`, returns `{ linkId }`. Short link format: `https://<host>/c/<linkId>#<secret>` — the secret lives in the URL fragment, assembled client-side, NEVER transmitted to the server.
- `POST /links/:id/funded` — client notifies after on-chain send confirms; indexer verifies independently.
- `GET /links/:id` — public claim metadata: `{ amount, note, senderDisplay, status }`. No secret, no hash exposure beyond what's on-chain anyway.
- `POST /claims` — body: `{ linkId, recipient, secret }`. **Exception to the no-secret rule**: the relayer must see the secret to submit the claim tx. Accept it over HTTPS, use it in the tx, never persist it. Relayer submits `claim()` sponsored.
- `POST /reclaims` — relayer submits `reclaim()` for sender after expiry.
- `GET /history/:address` — sent/received/pending for the home screen.

**Relayer** (`relayer.ts`):
- Single funded wallet (env: `RELAYER_PRIVATE_KEY`)
- Serial queue with nonce management (in-memory queue is fine for hackathon; persist pending txs to SQLite so a restart doesn't drop them)
- Retry with gas bump on stuck txs (max 3 retries)
- Health endpoint `GET /relayer/health` returning balance + queue depth
- Log every submission with claimId + txHash

**Indexer** (`indexer.ts`):
- Poll or WS-subscribe to `Sent`, `Claimed`, `Reclaimed` events
- Update SQLite status: created → funded → claimed | reclaimed | expired
- Store txHash per state transition (needed for the Receipts view)
- On startup, backfill from last processed block (store cursor in SQLite)

**SQLite schema** (minimum):
```sql
links(id TEXT PK, claim_hash TEXT, claim_id_onchain INTEGER, amount TEXT,
      note TEXT, sender TEXT, recipient TEXT, status TEXT,
      fund_tx TEXT, claim_tx TEXT, expiry INTEGER, created_at INTEGER);
cursor(key TEXT PK, block INTEGER);
relayer_queue(id INTEGER PK, kind TEXT, payload TEXT, status TEXT, tx_hash TEXT);
```

---

## 7. FRONTEND SPEC — web/

**Stack**: Vite + React + TypeScript, mobile-first responsive. Magic SDK for auth.

**Design direction** (critical — this is what wins or loses the hackathon):
- Payment-app warmth: think Cash App, Opay, Revolut. Rounded, confident, generous whitespace, one strong accent color.
- ZERO crypto vocabulary in the primary UI. Forbidden words in main flows: wallet, gas, chain, transaction, USDC (say "$"), address, confirm in wallet. 
- Human error copy: "This link was already claimed" — never "ERC20: transfer amount exceeds balance".
- Money amounts are the visual heroes: large, tabular numerals.
- Optional NGN display toggle: show ₦ equivalent next to $ amounts (hardcode or fetch a rate once; display-only).
- Loading, empty, and error states designed for every screen. No raw spinners on white.
- Claim success gets a real celebration moment (animation/confetti). This is the demo money shot; over-invest here.

**Screens**:
1. **Landing / Login** — one-tap "Continue with Google" via Magic. Target: login complete in ~10s.
2. **Send** — amount pad (big numerals), optional note, "Create link" → native share sheet / copy button. Client generates 32-byte random secret, computes `keccak256(secret)` as claimHash, calls API, then triggers the on-chain `send` (via relayer or user-op depending on variant). Target: login-to-shareable-link under 20 seconds.
3. **Claim** (`/c/:linkId#secret`) — shows "Ore sent you $25 🎉" (fetch metadata), Google login if needed, big Claim button, success animation, "It's yours" with balance. Handle states: pending-not-yet-funded, already claimed, expired, invalid link.
4. **Home / History** — balance, sent/received list, pending links with Cancel (reclaim) button post-expiry.
5. **Receipts** (collapsible / secondary) — every transfer's Arbiscan links. This is the "reveal" for judges; keep it one tap away but out of the main flow.

**Flows must work on a phone screen. Test at 375px width.**

---

## 8. IMPLEMENTATION PHASES

Work in this order. Each phase has a gate; do not proceed past a failed gate.

**Phase 0 — Spike & scaffold (days 1–2)**
1. Particle Universal Accounts SDK spike: EIP-7702 mode, one cross-chain transfer (e.g. Base Sepolia → Arbitrum Sepolia). HARD 2-DAY TIMEBOX. If it works cleanly: Variant A (UA Track). If it fights back: Variant B (ZeroDev), no revisiting.
2. Scaffold monorepo per structure above.
3. Magic Google login working end-to-end, wallet address logged.
- Gate: track decision made and recorded in README.

**Phase 1 — Escrow contract (days 3–4)**
4. Write RemitEscrow.sol + MockUSDC.sol per spec.
5. Full Foundry test suite green. **Do not write a single line of API code before tests pass** (base-signal-first rule: validate the core before wrapping product on it).
6. Deploy + verify on Arbitrum Sepolia.
- Gate: verified contract address in README, tests green in CI or documented run.

**Phase 2 — Backend (days 5–7)**
7. Link service (client-side secret, fragment-only).
8. Relayer with queue + nonce management + health endpoint.
9. Indexer with cursor + backfill.
10. History endpoint.
- Gate: curl-scripted end-to-end: create link → fund → claim → status flips to claimed with txHashes recorded.

**Phase 3 — Frontend (days 8–12, largest allocation — deliberately)**
11. Login, Send, Claim, Home, Receipts screens per spec.
12. Claim success animation polished.
13. NGN toggle.
- Gate: full flow on a real phone, sender phone → recipient phone, under 60 seconds.

**Phase 4 — Cross-chain (days 13–14, Variant A only)**
14. Recipient claims into Universal Account; demo balance usable cross-chain. Variant B: skip, spend both days on frontend polish.

**Phase 5 — Hardening (days 15–17)**
15. Edge cases: expired link, already claimed, self-claim, relayer out of gas (graceful message + retry), Magic session expiry mid-flow.
16. All empty/loading/error states, human copy pass.

**Phase 6 — Submission (days 18–19)**
17. Demo video: two phones side by side, full send→claim in <60s, then the Receipts reveal.
18. README: setup, architecture diagram, contract addresses, demo script, prize tracks entered.
19. Submit: General (or UA) Track + Arbitrum bounty + Magic bounty.

**Mid-milestone July 22**: Phases 0–2 complete, Send flow demoable.

**Cut list if behind** (in order): Phase 4, notifications, History screen, NGN toggle. **Never cut**: Claim flow polish.

---

## 9. ENVIRONMENT & CONFIG

`.env.example` must document every key:
```
# Chain
ARBITRUM_SEPOLIA_RPC=
CHAIN_ID=421614
ESCROW_ADDRESS=
USDC_ADDRESS=

# Relayer
RELAYER_PRIVATE_KEY=

# Magic
MAGIC_PUBLISHABLE_KEY=
MAGIC_SECRET_KEY=

# Particle (Variant A only)
PARTICLE_PROJECT_ID=
PARTICLE_CLIENT_KEY=
PARTICLE_APP_ID=

# App
BASE_URL=http://localhost:5173
API_PORT=3001
DATABASE_PATH=./owo.db
```

Never commit real keys. Never log secrets or claim secrets.

---

## 10. CODING STANDARDS & CONSTRAINTS

- TypeScript strict mode everywhere.
- ESM only in api/ and web/. No CommonJS anywhere.
- Pick ethers v6 OR viem at the start; do not mix.
- USDC is 6 decimals. All amount math in bigint base units; format only at the display edge. Never use floats for money.
- Commit at every phase gate minimum, with descriptive messages.
- README kept current as you go, not written at the end.
- Writing style for all docs/copy: concise, punchy, no em dashes anywhere (use commas, colons, or separate sentences).
- If a dependency or SDK behaves unexpectedly, timebox debugging to 2 hours, then implement the fallback and note it in README. Do not sink days into partner SDK issues.

## 11. DEFINITION OF DONE

- Foundry tests green.
- End-to-end on two real phones: Google login → send $X → share link → recipient Google login → claim → funds visible, under 60 seconds, zero crypto vocabulary shown.
- Every state transition has an Arbiscan-verifiable txHash in Receipts.
- Relayer survives a restart without losing pending claims.
- README lets a stranger run the whole stack in under 10 minutes.
- Demo video recorded.
