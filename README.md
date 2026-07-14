# Owó

**Send money like a message.** A mobile-first web app for peer-to-peer USDC transfer on Arbitrum, wrapped so neither sender nor recipient ever sees a wallet, gas fee, or chain name.

Built for the [UXmaxx Hackathon](https://www.encodeclub.com/programmes/uxmaxx-hackathon) (Encode Club x Particle Network).

<!-- TODO(submission): add the demo video link before submitting. -->
- **Live app**: [owo-eta.vercel.app](https://owo-eta.vercel.app)
- **Demo video**: _coming soon_ &lt;VIDEO_URL&gt;

<!-- TODO(submission): add real screenshots. Suggested: the Send amount screen,
     the Claim screen, and the confetti success moment, side by side at phone
     width. Drop the files in docs/ and reference them here. Example:
     ![Send](docs/send.png) ![Claim](docs/claim.png) ![Success](docs/success.png)
-->
_Screenshots: to be added._

---

## How it works

1. Sender logs in with Google, enters an amount, gets a shareable link.
2. Recipient opens the link, logs in with their own Google account, taps Claim.
3. Funds move on Arbitrum via a smart contract escrow. A relayer sponsors all gas.

Neither party ever sees a wallet address, seed phrase, gas fee, or chain name. The claim secret lives only in the URL fragment (after `#`), generated in the browser. It is never sent to or stored on the server, except transiently when the recipient submits a claim.


## Under the hood

The crypto machinery is real; it is just hidden from the user.

- **Google login (Magic).** Signing in with Google silently provisions each user's signing key. That key becomes the owner of a smart account. The user never sees a wallet, a seed phrase, or a private key.
- **Account abstraction (ZeroDev).** A Kernel smart account holds each user's on-chain identity, and a sponsored paymaster covers gas for every call, so nobody ever tops up for gas. `send()` and `reclaim()` require `msg.sender` to be the user's own identity, so they go out as sponsored UserOperations from the frontend while the user is present. `claim()` takes the recipient as an explicit parameter, so it is the one call a backend relayer submits, also sponsored, on the recipient's behalf.
- **Settlement (Arbitrum).** The escrow contract and USDC live on Arbitrum. Every send, claim, and reclaim is a real on-chain transaction, verifiable on Arbiscan from the Receipts tab.

## What makes it robust

**Security model.** Possession of the link is the authorization, like a check made out to cash. `claim()` lets the secret-holder pick the recipient by design. Revealing the secret on-chain cannot be front-run on Arbitrum (sequencer ordering, no public mempool), and only the app's relayer submits claims. The contract rejects zero amounts and the hash of an empty secret, so a client bug cannot mint claimable-by-anyone links.

**Crash recovery.** Claim secrets are never written to disk, so a relayer restart mid-claim cannot replay the transaction from the queue. Recovery is client-driven instead: the recipient taps Claim again, which is safe because the contract's Pending check makes resubmission idempotent. Funding is crash-proof on the other side too. If the sender's browser dies after the on-chain send but before notifying the API, the indexer independently matches the `Sent` event by claim hash and marks the link funded.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  web/       │────▶│  api/            │────▶│  Arbitrum        │
│  Vite+React │     │  Express + TS    │     │  RemitEscrow.sol │
│  Magic SDK  │     │  SQLite          │     │  USDC            │
│  ZeroDev    │     │  Relayer         │     └──────────────────┘
└─────────────┘     │  Indexer         │
                    └──────────────────┘
```

- **contracts/**: Foundry project. `RemitEscrow.sol` locks USDC against a `keccak256(secret)` hash; `MockUSDC.sol` is a mintable 6-decimal testnet stand-in. Full test suite (14 tests including a fuzz test) green.
- **api/**: Express + TypeScript (ESM), better-sqlite3, viem. Link metadata, sponsored relayer with nonce-managed queue and gas-bump retry, on-chain event indexer with cursor backfill.
- **web/**: Vite + React + TypeScript, mobile-first. Magic SDK for Google login, ZeroDev for account abstraction. Payment-app UX (Cash App / Opay warmth), zero crypto vocabulary in the primary flows.

## Deployed contracts

Deployed and verified on Arbitrum Sepolia:

- `RemitEscrow`: [`0x00d218141984B2e030CDBaA30C86916AD0633e29`](https://sepolia.arbiscan.io/address/0x00d218141984B2e030CDBaA30C86916AD0633e29)
- `MockUSDC`: [`0xd888A21708fCe03889B5275544831fb2179E6d9a`](https://sepolia.arbiscan.io/address/0xd888A21708fCe03889B5275544831fb2179E6d9a)

## Run it locally

Requires Node 20+ and [Foundry](https://book.getfoundry.sh/getting-started/installation).

Each package reads its own `.env`: Foundry and Vite only look in their own directory, so there is no single shared env file across the three. Each package's `.env.example` documents the keys that package actually reads.

```bash
# Contracts
cd contracts
forge install
forge test
cp .env.example .env      # RELAYER_PRIVATE_KEY, ARBITRUM_SEPOLIA_RPC, ARBISCAN_API_KEY

# API  (new terminal)
cd api
npm install
cp .env.example .env      # same RELAYER_PRIVATE_KEY/RPC, plus ESCROW_ADDRESS/USDC_ADDRESS
npm run dev

# Web  (new terminal)
cd web
npm install
cp .env.example .env      # VITE_MAGIC_PUBLISHABLE_KEY, VITE_ZERODEV_PROJECT_ID, chain config
npm run dev
```

Deploying the contract yourself:

```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url arbitrum_sepolia --broadcast --verify
```

The live app runs on Vercel (web) and Railway (api).

## Scope

No fiat on/off-ramps (mock only), no KYC, no multi-currency beyond USDC (NGN is a display-only conversion), no native mobile apps, no group payments or recurring transfers.
