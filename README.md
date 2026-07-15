# Owó

**Send money like a message.** A mobile-first web app for peer-to-peer USDC transfer on Arbitrum, wrapped so neither sender nor recipient ever sees a wallet, gas fee, or chain name.

Built for the [UXmaxx Hackathon](https://www.encodeclub.com/programmes/uxmaxx-hackathon) (Encode Club x Particle Network).

- **Live app**: [owo-eta.vercel.app](https://owo-eta.vercel.app)
<!-- TODO(submission): replace with the real demo video URL before submitting. -->
- **Demo video**: _recording in progress_

<!-- TODO(submission): add real screenshots. Suggested: the Send amount screen,
     the Claim screen, and the confetti success moment, side by side at phone
     width. Drop the files in docs/ and reference them here. Example:
     ![Send](docs/send.png) ![Claim](docs/claim.png) ![Success](docs/success.png)
-->
_Screenshots: to be added._

---

## How it works

1. Sender logs in with Google and taps **Add money** to fund a fresh account (see below), then enters an amount and gets a shareable link.
2. Recipient opens the link, logs in with their own Google account, taps Claim.
3. Funds move on Arbitrum via a smart contract escrow. A relayer sponsors all gas.

Neither party ever sees a wallet address, seed phrase, gas fee, or chain name. The recipient's screen says who it is from ("Ore sent you $25"), with the note if there was one. Amounts can be viewed in dollars or Naira with a single toggle, for anyone who thinks in ₦. The claim secret lives only in the URL fragment (after `#`), generated in the browser. It is never sent to or stored on the server, except transiently when the recipient submits a claim.

**Getting money.** This is a testnet demo with no fiat on-ramp, so a new account starts at $0. Tapping **Add money** opens an add-cash sheet with a demo card, styled like the rest of the app, with no crypto vocabulary. Under the hood it calls the backend, which has the relayer mint test USDC (`MockUSDC`, a mintable stand-in for real USDC) straight to the account, capped per account to prevent spam. The demo card stands in for what would be a real card or on-ramp in production.


## Under the hood

The crypto machinery is real; it is just hidden from the user.

- **Google login (Magic).** Signing in with Google silently provisions each user's signing key. That key becomes the owner of a smart account. The user never sees a wallet, a seed phrase, or a private key.
- **Account abstraction (ZeroDev).** A Kernel smart account holds each user's on-chain identity, and a sponsored paymaster covers gas for every call, so nobody ever tops up for gas. `send()` and `reclaim()` require `msg.sender` to be the user's own identity, so they go out as sponsored UserOperations from the frontend while the user is present. `claim()` is restricted on-chain to a backend relayer (see the security model below), which submits it, also sponsored, on the recipient's behalf.
- **Settlement (Arbitrum).** The escrow contract and USDC live on Arbitrum. Every send, claim, and reclaim is a real on-chain transaction. The proof stays out of the way: no chain vocabulary in the primary UI, with the Arbiscan link one tap into any transaction's detail from the Activity tab.

## What makes it robust

**Security model.** Possession of the link is the authorization, like a check made out to cash: `claim()` lets the secret-holder pick the recipient by design. The contract rejects zero amounts and the hash of an empty secret, so a client bug cannot mint claimable-by-anyone links. Arbitrum's sequencer exposes no public mempool, so a *pending* claim cannot be front-run the usual way.

**The reverted-calldata exposure, and how it is closed.** `claim()` reveals the secret in transaction calldata, so a reverted claim (out of gas, or a race) would leave that secret readable on-chain while the link is still `Pending`, and whoever read it could redirect the funds before the honest retry landed. Two changes close that window:

- **`claim()` is gated to the relayer on-chain.** It reverts for any other caller (`NotRelayer`), so a leaked secret cannot be spent by calling the contract directly.
- **The API locks each link to the first recipient that submits a valid claim.** The secret only becomes public *after* a claim attempt, and that attempt has already locked the link to the honest recipient, so a follow-up claim carrying the leaked secret to a different address is refused.

Together these mean a leaked secret cannot be redirected. What remains is the intended bearer-token property of the check-to-cash model: whoever the sender shares the raw link with can claim it.

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

- **contracts/**: Foundry project. `RemitEscrow.sol` locks USDC against a `keccak256(secret)` hash and gates `claim()` to the relayer; `MockUSDC.sol` is a mintable 6-decimal testnet stand-in. Full test suite (15 tests including a fuzz test) green.
- **api/**: Express + TypeScript (ESM), better-sqlite3, viem. Link metadata, a test-money faucet, sponsored relayer with nonce-managed queue and gas-bump retry, on-chain event indexer with cursor backfill.
- **web/**: Vite + React + TypeScript, mobile-first. Magic SDK for Google login, ZeroDev for account abstraction. Warm payment-app UX (Cash App / Opay warmth) with sender/recipient identity, a $/₦ toggle, and zero crypto vocabulary in the primary flows.

## Deployed contracts

Deployed and verified on Arbitrum Sepolia:

- `RemitEscrow`: [`0xF9C4011F7CcC6C51BC9911887A65ce84D9d63192`](https://sepolia.arbiscan.io/address/0xF9C4011F7CcC6C51BC9911887A65ce84D9d63192)
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

## Roadmap

Owó today runs on Arbitrum Sepolia with USDC as the settlement asset, and funds enter through an in-app top-up. The path to a production remittance product is mainly about connecting the edges to local fiat:

- **Fiat deposit (Paystack).** Let a sender fund their Owó balance with a card or bank transfer through Paystack, so the first dollar in requires no crypto at all. The on-chain USDC is minted or purchased behind the deposit; the user just sees money arrive.
- **Fiat withdrawal / off-ramp.** Let a recipient cash out to a local bank account (bank name, account number) via a Paystack payout, closing the loop so money can leave Owó as easily as it enters. This is the step that turns a claimed link into spendable cash in Lagos or Nairobi.
- **Mainnet and real USDC.** Move settlement to Arbitrum One with canonical USDC once the ramps are wired.
- **Multi-corridor rates.** Live FX for the ₦ display, extended to other diaspora corridors beyond Naira.

The deliberate design choice for this hackathon was to prove the hard part first: that money can move between two people who have never touched crypto, fully on-chain, with the wallet, gas, and chain completely invisible. The fiat ramps are well-understood integrations that sit on top of that proven core.
