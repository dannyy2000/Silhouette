# Silhouette Frontend

Next.js app for the Silhouette interest rate swap, talking directly to
the contracts deployed on Starknet Sepolia (see the root
[README.md](../README.md#deployment) for addresses). No backend, no
indexer — every page reads straight from the chain via
`@starknet-react/core` + `starknet.js`, and posting/accepting/settling a
swap is a real wallet transaction against the live contracts.

## Pages

- `/` — what the protocol is and how it works
- `/market` — every open offer, read live from `swap_core` by iterating
  `1..=get_offer_count()` (there's no on-chain enumeration beyond that)
- `/create` — post a fixed-rate offer (approve + `post_offer` in one
  wallet prompt)
- `/dashboard` — your own offers and swaps, with cancel / settle epoch /
  close actions

## Run it

```bash
npm install
npm run dev
```

Requires a Starknet Sepolia wallet (Argent X or Braavos browser
extension) with testnet ETH or STRK for gas, and some
`MockCollateralToken` balance — mint it yourself by calling `mint` on
the collateral token contract (anyone can, it's a testnet mock, see root
README).

## Configuration

Contract addresses default to the deployed Sepolia addresses in
`lib/contracts.ts`. Override via `.env.local` (see `.env.example`) if
you redeploy:

```
NEXT_PUBLIC_COLLATERAL_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_RATE_ORACLE_ADDRESS=0x...
NEXT_PUBLIC_SWAP_CORE_ADDRESS=0x...
```

All three are optional — the app works with no `.env.local` at all
against the addresses already live on Sepolia.

ABIs in `lib/abi/` are generated from the compiled contracts
(`target/dev/*.contract_class.json` in the repo root after `scarb
build`) — regenerate them if the contracts change.

## Deploy to Vercel

The one thing that isn't zero-config: this Next.js app lives in
`frontend/`, not the repo root, so Vercel needs to be told where to
look.

1. [vercel.com/new](https://vercel.com/new) → import
   `dannyy2000/Silhouette`.
2. Under **Root Directory**, click Edit and select `frontend`. This is
   the only non-default setting required — Vercel auto-detects
   Next.js and handles the build/output config from there.
3. Environment variables: none required. Only add the three
   `NEXT_PUBLIC_*` addresses above (in the Vercel project's
   Environment Variables settings) if you've redeployed the contracts
   yourself and want to point at different addresses.
4. Deploy. No secrets, no backend, no database — it's a static Next.js
   app that talks directly to Starknet Sepolia from the browser.
