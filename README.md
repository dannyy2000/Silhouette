# Silhouette

> A silhouette shows that a shape exists without revealing its detail. This
> protocol lets the market see that a rate swap exists and settled
> correctly — not who is in it, how large it is, or which side either
> party took.

[![Cairo](https://img.shields.io/badge/Cairo-2.x-orange)](https://www.cairo-lang.org/)
[![Target](https://img.shields.io/badge/target-Starknet-blue)](https://www.starknet.io/)
[![Status](https://img.shields.io/badge/status-deployed%20to%20Sepolia-yellow)](#status)
[![Tests](https://img.shields.io/badge/tests-14%20passing-brightgreen)](#testing)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

---

Starknet just went live with trustless BTC staking. BTC holders stake
without giving up custody and earn a share of STRK emissions — but the
realized rate moves every epoch depending on how much total BTC is staked
relative to STRK. Nobody can lock that rate in, and if they try to hedge
it on any chain that exists today, the hedge itself — its size, its
direction, who's in it — is fully visible to everyone watching the chain.

**Silhouette fixes both problems at once.** It lets one party lock in a
guaranteed fixed yield on their BTC-staking rate while a counterparty
takes the floating side — settled automatically on-chain through Cairo
smart contracts — while using Starknet's STRK20 privacy layer so that
position size and side are visible only to the two people in the trade.

---

## Status

**This is a working, tested, and deployed skeleton — not an audited or
production-ready protocol.** Concretely, as of this commit:

- `scarb build` passes and `snforge test` runs 14 passing tests covering
  the full offer/accept/settle/close lifecycle, cancellation, double-
  settlement rejection, missing-oracle-rate handling, and liquidation.
- All three contracts are declared and deployed on Starknet Sepolia
  testnet — see [Deployment](#deployment) for addresses. No swaps have
  been posted against this deployment; it proves the contracts declare,
  deploy, and wire together correctly on a live network, not a market
  with real activity.
- `swap_core.cairo` moves collateral through a fully public mock token
  (`mock_collateral_token.cairo`) — no privacy is wired in yet. STRK20
  SDK access has not been requested.
- No audit, no static analysis, no fuzzing. Not deployed to mainnet, and
  should not be until an audit happens.

Every claim below about what the protocol *will* do is a design claim
about intended behavior, not implemented or verified functionality.
Nothing below should be read as "already working on Starknet."

---

## Table of Contents

- [Background — What is Starknet's BTC-staking yield?](#background--what-is-starknets-btc-staking-yield)
- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [How the Rate is Calculated](#how-the-rate-is-calculated)
- [Mechanism Walkthrough](#mechanism-walkthrough)
- [Settlement Examples](#settlement-examples)
- [The Privacy Layer — Two Tiers, Stated Honestly](#the-privacy-layer--two-tiers-stated-honestly)
- [What's Visible to Whom, at Each Step](#whats-visible-to-whom-at-each-step)
- [Contract Architecture](#contract-architecture)
- [Contract Reference](#contract-reference)
- [Frontend](#frontend)
- [Development Setup](#development-setup)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security Considerations](#security-considerations)
- [Known Gaps](#known-gaps)
- [Roadmap](#roadmap)
- [Why Starknet](#why-starknet)
- [Accelerator Context](#accelerator-context)
- [License](#license)

---

## Background — What is Starknet's BTC-staking yield?

Starknet runs a **dual-token consensus model**: STRK stake represents 75%
of the network's total security weight, and BTC stake represents the
other 25%. BTC holders can stake BTC to Starknet without giving up
custody — a trustless L2 staking mechanism — and in return receive a
share of STRK emissions.

The catch: BTC stakers as a group receive a **fixed 25% share of total
STRK emissions**, but that pool gets divided across however much BTC is
actually staked network-wide at any given time. Stake more BTC and the
STRK-per-BTC rate drops, because the same fixed emissions pool is now
split more ways. Stake less, and the rate rises. The rate an individual
staker realizes is therefore variable, driven entirely by aggregate
network behaviour nobody controls or predicts precisely — the same shape
of problem PoX yield has on Stacks, and the same shape of problem ETH
staking rates have on Ethereum.

Starknet publishes this as one of its 2026 roadmap milestones alongside
native privacy (STRK20). Both went live within months of each other,
which is what makes this specific product possible now and not earlier —
see [Why Starknet](#why-starknet).

---

## The Problem

The realized BTC-staking rate is variable, epoch to epoch. For an
individual staker, that's an inconvenience. For a fund or treasury
committing meaningful BTC to Starknet, it's a planning problem — you
cannot underwrite a structured product, run a treasury strategy, or
quote a rate to a client without knowing what yield you'll actually
receive.

That problem already has an answer on Ethereum: Pendle's Boros product
lets participants trade fixed-vs-floating exposure on funding/staking
rates, clearing roughly $2.9B in monthly volume. **Nothing equivalent
exists for Starknet's BTC-staking yield.**

But there's a second, sharper problem underneath the first one, specific
to anyone large enough to need this product in the first place: hedging
is a strategic disclosure. The moment you post a fixed-rate offer or
accept one, you've told the market your position size and your directional
view on where rates are headed. On every existing rate-hedging product —
Boros included — this happens completely in the open. A fund large enough
to move the market with its hedge is also large enough that revealing the
hedge lets others front-run or copy it before it's fully in place.

**There is currently no rate-hedging product for Starknet's BTC-staking
yield, private or public. And there is no privately-held rate derivative
of this kind on any chain, because until STRK20, no chain gave token
balances native shielding to build on.**

---

## The Solution

Silhouette is an **interest rate swap protocol**, built on Starknet using
Cairo smart contracts, with collateral held through STRK20's shielded
balances once that integration lands (see
[Privacy Layer](#the-privacy-layer--two-tiers-stated-honestly) for
exactly what's true today versus planned).

### How it actually fixes the rate

Here's the core mechanism: Silhouette does not intercept your staking yield. You still stake BTC and
still receive STRK directly from Starknet's staking mechanism every
epoch. Silhouette runs a **separate settlement alongside your staking**
that mathematically cancels out the rate variability.

Every epoch, the contract calculates two numbers on a shared reference
amount (the notional):

```
what the fixed party is owed    = notional × fixed_rate  ÷ 1,000,000
what the variable party is owed = notional × actual_rate ÷ 1,000,000
```

Only the **net difference** between these two numbers moves — out of the
collateral of whichever party owes more.

**When the actual staking rate is LOWER than the fixed rate:** the
variable party pays the gap into the fixed party's collateral. The fixed
party's staking earnings were low this epoch, but the swap compensates
them for exactly the missing amount.

**When the actual staking rate is HIGHER than the fixed rate:** the fixed
party pays the excess into the variable party's collateral. They earned
more from staking this epoch, but pass the excess on.

**The result:** the fixed party's net yield is always the rate they
locked in, regardless of what the network-wide rate actually does. The
variable party absorbs all the rate movement.

**A concrete example with numbers:**

```
Agreed fixed rate:  80 bps  (80 units of STRK per 1,000,000 sats of BTC staked, per epoch)
Notional:           10,000,000 (sats-denominated BTC notional)

Epoch A — BTC staking participation drops, actual rate = 100 bps:
  Fixed party earns from staking:   1,000 STRK-units
  Fixed party owes to swap:           200 STRK-units  (100 - 80 = 20 bps × notional)
  Fixed party net:                    800 STRK-units  ← exactly 80 bps

Epoch B — BTC staking participation rises, actual rate = 55 bps:
  Fixed party earns from staking:     550 STRK-units
  Fixed party receives from swap:     250 STRK-units  (80 - 55 = 25 bps × notional)
  Fixed party net:                    800 STRK-units  ← exactly 80 bps

In both epochs, the fixed party nets exactly what they agreed to.
The variable party absorbs all the rate movement — profiting when the
rate rises, paying when it falls.
```

### The two sides of a swap

**Fixed side — the hedger.** You're staking BTC on Starknet and want
certainty about your STRK yield. You post a swap offer specifying the
fixed rate you want, a notional amount, and a duration, and deposit
collateral. Every epoch, the swap settles — compensating you when rates
fall, passing your excess to the variable party when rates rise. Your
effective yield always equals the rate you agreed to. Once STRK20
integration lands, your collateral, notional, and identity are visible
to nobody but your counterparty.

**Variable side — the speculator.** You believe the BTC-staking rate is
rising, or want direct exposure to it without staking BTC yourself. You
accept a fixed-rate offer and deposit collateral. Every epoch you collect
the excess when the actual rate beats the fixed rate, and cover the gap
when it falls below. You profit from rate volatility — the exact risk the
fixed party is hedging away.

**Neither party moves principal.** Only the net difference in yield
calculations transfers between collateral balances each epoch. This is
the defining feature of an interest rate swap.

---

## How the Rate is Calculated

The BTC-staking yield rate is derived from two numbers:

| Input | Source |
|---|---|
| STRK emitted to BTC stakers in the epoch | Starknet's native staking contract (admin-submitted to `staking_rate_oracle` in Phase 1; direct on-chain read in Phase 2) |
| Total BTC staked in the epoch | Starknet's native staking contract |

**Oracle formula — rate per epoch:**

```
rate_bps = (strk_reward × 1,000,000) ÷ total_btc_staked
```

This gives the rate in basis points: STRK-units earned per 1,000,000 sats
of BTC staked, per epoch — a self-contained unit, no BTC/STRK price feed
needed to interpret it.

**Settlement formula — payment per epoch:**

```
payment = notional × rate_bps ÷ 1,000,000
```

Run once for the fixed rate, once for the actual rate. The net difference
is the transfer between parties.

### Why this oracle is a smaller trust problem than it looks

Silhouette's yield source (Starknet's own staking contract) lives on the
**same chain** as the swap contract. Phase 2 here is a same-chain
cross-contract read, not a cross-chain proof — a structurally simpler
problem than verifying a yield source that lives partly on a different
chain would be. It has not been implemented yet (see
[Known Gaps](#known-gaps)), but the path doesn't require anything
Starknet doesn't already provide.

---

## Mechanism Walkthrough

### Step 1 — Fixed party posts an offer

```
collateral_token.approve(swap_core_address, 5_000_000)   // required first — see below

post_offer(
    notional:         10_000_000,   // sats-denominated BTC notional
    fixed_rate_bps:    80,          // 80 STRK-units per 1M sats staked, per epoch
    duration_epochs:   6,           // runs for 6 staking epochs
    collateral:        5_000_000,   // collateral deposited
)
```

`post_offer` pulls the fixed party's collateral into escrow via
`ICollateralToken.transfer_from`, which is allowance-based: the fixed
party must call `approve(swap_core_address, collateral)` on the
collateral token *before* calling `post_offer`, exactly like a standard
ERC-20 `approve` + `transferFrom` flow. This is required because
Starknet's `get_caller_address()` returns the *immediate* caller inside
a called contract — when `swap_core` calls the token, the token sees
`swap_core` as the caller, not the fixed party's own address — so
authorization has to run through an allowance, not a direct address
comparison. The offer becomes visible on the market (today: fully public
via the mock token; target: STRK20-shielded, see below). It remains open
until accepted or cancelled.

### Step 2 — Variable party accepts the offer

```
collateral_token.approve(swap_core_address, 7_500_000)   // required first, same reason as above

accept_offer(
    offer_id:                1,
    variable_collateral:     7_500_000,   // must meet 110% maintenance margin
)
```

The variable party's collateral is locked the same way (approve, then
`accept_offer` pulls it via `transfer_from`). An active swap
is created starting from the current staking epoch. The offer is marked
accepted and can no longer be cancelled.

### Step 3 — Oracle posts the epoch rate

After a staking epoch completes, the oracle owner submits the STRK reward
paid to BTC stakers and the total BTC staked:

```
submit_epoch_rate(
    epoch:               85,
    strk_reward:          800_000_000,     // STRK-units emitted to BTC stakers this epoch
    total_btc_staked:     10_000_000_000_000, // sats of BTC staked network-wide
)
```

The contract calculates and stores the rate:
`800,000,000 × 1,000,000 ÷ 10,000,000,000,000 = 80 bps`.

### Step 4 — Settlement runs (anyone can call)

```
settle_epoch(swap_id: 1, epoch: 85)
```

The contract:
1. Reads the oracle rate for epoch 85.
2. Calculates the fixed payment: `notional × fixed_rate ÷ 1,000,000`.
3. Calculates the variable payment: `notional × actual_rate ÷ 1,000,000`.
4. Computes the net difference and moves it between internal collateral
   balances.
5. Checks the variable party's maintenance margin — if below 110% of
   remaining obligation, triggers automatic liquidation.
6. Emits an `EpochSettled` event with the full breakdown.

No wallet needs to sign this transaction — any address can call it, by
design, so settlement never depends on either party showing up.

### Step 5 — Swap closes

Once all epochs are settled, anyone can call `close_swap(swap_id: 1)`.
The contract releases the remaining collateral balances back to each
party.

---

## Settlement Examples

**Example A — Variable party wins (actual rate > fixed rate)**

```
Notional:        10,000,000
Fixed rate:       80 bps
Actual rate:      95 bps  (BTC staking participation dropped this epoch)

Fixed payment    = 10,000,000 × 80 ÷ 1,000,000 = 800 units
Variable payment = 10,000,000 × 95 ÷ 1,000,000 = 950 units

Net = 950 - 800 = 150 units, transferred fixed_collateral → variable_collateral

Variable party profited 150 units this epoch.
Fixed party received their guaranteed 800-unit equivalent (collateral adjusted).
```

**Example B — Fixed party wins (actual rate < fixed rate)**

```
Notional:        10,000,000
Fixed rate:       80 bps
Actual rate:      55 bps  (BTC staking participation rose this epoch)

Fixed payment    = 10,000,000 × 80 ÷ 1,000,000 = 800 units
Variable payment = 10,000,000 × 55 ÷ 1,000,000 = 550 units

Net = 800 - 550 = 250 units, transferred variable_collateral → fixed_collateral

Fixed party received their guaranteed 800-unit equivalent.
Variable party paid 250 units from their collateral.
```

**Example C — Liquidation triggered**

If the variable party's collateral falls below 110% of their remaining
obligation across future epochs, the contract liquidates immediately —
all accumulated collateral returns to both parties at their current
correct balances, and the swap's status becomes `2` (liquidated).

```
remaining_obligation = remaining_epochs × notional × fixed_rate ÷ 1,000,000
min_collateral        = remaining_obligation × 110 ÷ 100

if variable_collateral < min_collateral → liquidate
```

---

## The Privacy Layer — Two Tiers, Stated Honestly

This is the part of the design most likely to be oversold if stated
loosely, so it's spelled out in full here rather than summarized.

### The underlying primitive: SNIP-36

Starknet shipped **SNIP-36** in protocol version v0.14.2 (live on
mainnet): a mechanism for a transaction to attach an **off-chain-generated
STARK proof** that the network verifies natively, without a contract
having to verify it itself — proofs are far too large to fit through
normal contract execution any other way. This is a **general-purpose**
primitive. It is not specific to token privacy, and it is not owned by
any single application.

### STRK20: the reference application, not the ceiling

**STRK20** is one application built on top of SNIP-36, scoped to ERC-20
tokens: shield a balance, transfer privately, swap through existing
public liquidity (by briefly unshielding, executing against the public
pool, then reshielding the result), and withdraw. Optional viewing keys
let one designated auditor decrypt a single user's history for
compliance, without exposing it to the counterparty or the public.

**What STRK20 gives Silhouette off the shelf:** a shielded balance and
transfer primitive that `i_collateral_token.cairo` can be pointed at,
replacing `mock_collateral_token.cairo`, with zero changes to
`swap_core.cairo`'s logic. **What STRK20 does not give Silhouette:** any
existing mechanism for a *contract* (as opposed to a wallet) to compute
conditional financial logic — matching an offer, applying a rate, paying
out a settlement — while amounts stay hidden through that computation.

### Tier 1 — buildable with what's shipped today

Collateral sits in an STRK20 shielded balance the entire time nobody's
actively trading. Positions and holdings are private between
settlements. At settlement, the same pattern STRK20's own private-swap
feature already uses gets reused here: unshield the two amounts just
long enough to run the rate math, pay out the difference, reshield the
result. The **holding** is private end-to-end. The **moment of
settlement computation** briefly touches plaintext numbers — this is the
same tradeoff STRK20 itself accepts for its own swap feature, not a
weaker standard invented for this project.

This is realistic, accelerator-timeline work: swap the token
implementation behind an existing interface, once SDK access is granted.

### Tier 2 — not built, the actual research contribution

Because SNIP-36 is general-purpose, it's possible in principle to write a
**custom Cairo circuit** proving `payout = hidden_notional × public_rate`
is correct without the notional ever appearing anywhere, even
momentarily — closer to what Aztec does with private smart contracts
than to "call the STRK20 SDK." Nobody has built this circuit. It doesn't
exist in the STRK20 SDK today, and there's no public precedent for it on
Starknet for a multi-party financial contract like a swap.

This is the frontier problem worth an accelerator's attention — not a
stretch goal added for narrative effect, but the specific gap between
"private holding of a public computation" (Tier 1, what STRK20 already
gives everyone) and "a computation that's private all the way through"
(Tier 2, unbuilt, anywhere).

`swap_core.cairo`, as currently written, implements the swap logic
completely but moves collateral through a fully public mock token — i.e.
it is the shared logic skeleton both tiers get built on top of, and is
itself neither tier yet.

---

## What's Visible to Whom, at Each Step

Target design (Tier 1, once STRK20 is wired in) versus what exists today:

| Step | Today (mock token) | Tier 1 target (STRK20) | Tier 2 target (custom circuit) |
|---|---|---|---|
| Offer posted | Notional, rate, party — all public | Only that an offer was posted; amount/party shielded | Same as Tier 1 |
| Offer accepted | Both parties, both collateral amounts — public | Only that a swap was created; amounts/parties shielded | Same as Tier 1 |
| Epoch settlement | Full payment breakdown emitted publicly | Payment breakdown momentarily computed in the clear during settlement, then reshielded | Payment computed and verified without ever appearing in the clear |
| Public rate data | Public | Public (unchanged — it's network-wide, not a position) | Public (unchanged) |
| Compliance | None | Optional per-party viewing key to a designated auditor | Optional per-party viewing key to a designated auditor |

---

## Contract Architecture

```
src/
├── lib.cairo                          Module root
├── interfaces.cairo                   Interface module root
├── interfaces/
│   └── i_collateral_token.cairo       Collateral-movement interface (swappable implementation)
├── mock_collateral_token.cairo        Testnet mock — fully public, implements i_collateral_token
├── staking_rate_oracle.cairo          Stores and calculates BTC-staking yield rates per epoch
└── swap_core.cairo                    Core swap protocol — full lifecycle management
```

**Deployment order matters:**

```
1. i_collateral_token     (interface, no deployment — compiled in)
2. mock_collateral_token  (implements i_collateral_token)
3. staking_rate_oracle    (no dependencies)
4. swap_core              (constructor takes collateral_token + rate_oracle addresses)
```

---

## Contract Reference

### `interfaces/i_collateral_token.cairo`

The interface `swap_core.cairo` calls for all collateral movement.
Swapping the implementation behind this interface — mock token today,
STRK20 shielded adapter later — is the entire Tier 1 migration.
`swap_core.cairo` itself does not change when that happens.

| Function | Parameters | Returns | Notes |
|---|---|---|---|
| `transfer` | `recipient: ContractAddress, amount: u256` | `bool` | Caller-initiated transfer |
| `transfer_from` | `sender: ContractAddress, recipient: ContractAddress, amount: u256` | `bool` | Used by `swap_core` to pull collateral into escrow. Allowance-based — `sender` must have called `approve(caller, amount)` first. |
| `approve` | `spender: ContractAddress, amount: u256` | `bool` | Caller-initiated; sets `spender`'s allowance over the caller's balance |
| `allowance` | `owner: ContractAddress, spender: ContractAddress` | `u256` | Read-only |
| `balance_of` | `account: ContractAddress` | `u256` | Read-only |
| `mint` | `recipient: ContractAddress, amount: u256` | — | Testnet-only on the mock implementation |

---

### `mock_collateral_token.cairo`

Fully public testnet stand-in for shielded BTC collateral. Anyone can
mint. **Never deploy to mainnet.**

Standard ERC-20 allowance model: `transfer_from` checks and decrements
`allowances[sender][caller]`, not `caller == sender`. That distinction
matters here specifically because Starknet's `get_caller_address()` is
the *immediate* caller inside a called contract, not the original
account that started the transaction — so `swap_core` calling
`transfer_from` on a user's behalf can only be authorized through an
allowance the user granted `swap_core` directly, not by comparing
addresses.

| Function | Access | Description |
|---|---|---|
| `transfer` | Public | Move tokens from caller to recipient |
| `transfer_from` | Public | Moves tokens from `sender` to `recipient`, decrementing the caller's allowance over `sender` |
| `approve` | Public | Caller sets `spender`'s allowance over their own balance (overwrites, does not add) |
| `allowance` | Read-only | Current allowance `spender` has over `owner`'s balance |
| `balance_of` | Read-only | Balance for any address |
| `mint` | Public (testnet only) | Mint tokens to any address |

**Errors:**

| Message | Meaning |
|---|---|
| `'insufficient allowance'` | `transfer_from` caller's allowance over `sender` is below `amount` |
| `'insufficient balance'` | Sender's balance is below the transfer amount |

**Events:** `Transfer { from, to, amount }`, `Approval { owner, spender, amount }`, `Mint { to, amount }`

---

### `staking_rate_oracle.cairo`

Stores verified BTC-staking yield rates for each epoch. Phase 1: the
owner (contract deployer) submits the raw STRK reward and total BTC
staked after each epoch; the contract calculates and stores the rate.
Phase 2 (not built): direct on-chain read of Starknet's staking contract
— see [How the Rate is Calculated](#how-the-rate-is-calculated) for why
this is a same-chain problem.

**`EpochRate` struct:**

```
{
    strk_reward:        u256,   // STRK emitted to BTC stakers this epoch
    total_btc_staked:   u256,   // sats of BTC staked network-wide
    rate_bps:           u256,   // calculated rate
    submitted_at:       u64,    // block timestamp at submission
}
```

**Functions:**

| Function | Access | Parameters | Returns | Description |
|---|---|---|---|---|
| `submit_epoch_rate` | Owner only | `epoch: u64, strk_reward: u256, total_btc_staked: u256` | `u256` (the calculated rate) | Submit data for a completed epoch |
| `get_epoch_rate` | Read-only | `epoch: u64` | `Option<EpochRate>` | Full rate data for the given epoch, or `None` |
| `get_latest_rate` | Read-only | — | `Option<EpochRate>` | Rate data for the most recently submitted epoch |
| `get_latest_epoch` | Read-only | — | `u64` | Epoch number of the most recently submitted rate (`0` if none submitted yet). `swap_core.accept_offer` uses `get_latest_epoch() + 1` as a new swap's `start_epoch`, since a swap can never start on an epoch whose rate is already known. |
| `get_owner` | Read-only | — | `ContractAddress` | The admin address |

**Errors:**

| Message | Meaning |
|---|---|
| `'not authorized'` | Caller is not the oracle owner |
| `'epoch rate exists'` | Rate for this epoch was already submitted |
| `'zero staked'` | `total_btc_staked` cannot be zero |

**Events:** `RateSubmitted { epoch, rate_bps }`

**Constant:** `PRECISION = 1_000_000`

---

### `swap_core.cairo`

The core swap protocol. Manages the complete lifecycle of offers and
swaps, holds all collateral in escrow via `i_collateral_token`, enforces
the maintenance margin rule, and settles each epoch based on oracle data.

**`Offer` status values:**

| Value | Meaning |
|---|---|
| `0` | Open — waiting for a variable party to accept |
| `1` | Accepted — swap has been created |
| `2` | Cancelled — fixed party cancelled, collateral returned |

**`Swap` status values:**

| Value | Meaning |
|---|---|
| `0` | Active — epochs are settling |
| `1` | Completed — all epochs settled, collateral released |
| `2` | Liquidated — variable party's margin was breached |

**Functions:**

| Function | Caller | Parameters | Returns | Description |
|---|---|---|---|---|
| `post_offer` | Fixed party | `notional: u256, fixed_rate_bps: u256, duration_epochs: u64, collateral: u256` | `u64` (offer id) | Post a fixed-rate offer and lock collateral |
| `accept_offer` | Variable party | `offer_id: u64, variable_collateral: u256` | `u64` (swap id) | Accept an open offer, lock collateral, create swap |
| `settle_epoch` | Anyone | `swap_id: u64, epoch: u64` | `(u256, u256)` (fixed payment, variable payment) | Settle one epoch using the oracle rate |
| `close_swap` | Anyone | `swap_id: u64` | — | Release remaining collateral after all epochs settle |
| `cancel_offer` | Fixed party only | `offer_id: u64` | — | Cancel an open (unaccepted) offer and reclaim collateral |
| `get_offer` | Read-only | `offer_id: u64` | `Option<Offer>` | Full offer data or `None` |
| `get_swap` | Read-only | `swap_id: u64` | `Option<Swap>` | Full swap data or `None` |
| `get_epoch_settlement` | Read-only | `swap_id: u64, epoch: u64` | `Option<EpochSettlement>` | Settlement record for one epoch or `None` |
| `get_offer_count` | Read-only | — | `u64` | Highest offer id assigned. Offer ids are sequential from 1, so a client can discover all offers by iterating `1..=get_offer_count()` and calling `get_offer` per id — there's no on-chain enumeration beyond that. |
| `get_swap_count` | Read-only | — | `u64` | Highest swap id assigned, same iteration pattern as `get_offer_count` |

**Errors:**

| Message | Meaning |
|---|---|
| `'invalid notional'` | `notional` is zero |
| `'invalid collateral'` | `collateral` is zero |
| `'invalid duration'` | `duration_epochs` is zero |
| `'offer not found'` | Offer id does not exist |
| `'offer not open'` | Offer is not in open status |
| `'swap not found'` | Swap id does not exist |
| `'swap not active'` | Swap is not in active status |
| `'epoch already settled'` | This epoch has already been settled |
| `'epoch out of range'` | Epoch is outside the swap's duration |
| `'not all epochs settled'` | Cannot close swap — epochs remain |
| `'not authorized'` | Caller does not have permission (e.g. cancelling someone else's offer) |
| `"oracle rate not found"` (panic) | Oracle has no rate for the requested epoch |

**Constants:** `PRECISION = 1_000_000`, `MARGIN_NUMERATOR = 110`, `MARGIN_DENOMINATOR = 100`

**Events:** `OfferPosted`, `SwapCreated`, `EpochSettled`, `Liquidation`, `SwapClosed`, `OfferCancelled`

---

## Development Setup

Verified end-to-end against this repo — `scarb build` and `snforge test`
both run clean with the versions below.

### Prerequisites

| Tool | Version |
|---|---|
| [Scarb](https://docs.swmansion.com/scarb/) | ≥ 2.8.0 (tested against 2.14.0) |
| [Starknet Foundry](https://foundry-rs.github.io/starknet-foundry/) (`snforge`, `sncast`) | 0.53.0 — pinned exactly in `Scarb.toml`'s `snforge_std` dependency. Scarb will otherwise resolve the latest `snforge_std` (e.g. 0.62.x), which uses cheatcodes the 0.53.0 `snforge` binary doesn't support, and every test fails at runtime with `Function 'set_next_syscall_from_cheatcode' is not supported`. If you install a newer Starknet Foundry, bump the pin in `Scarb.toml` to match. |

### Clone and build

```bash
git clone git@github.com:dannyy2000/Silhouette.git
cd Silhouette
scarb build
```

Expected output:
```
Compiling silhouette v0.1.0
Finished `dev` profile target(s)
```

### Run tests

```bash
snforge test
```

Expected output:
```
Collected 14 test(s) from silhouette package
Tests: 14 passed, 0 failed, 0 ignored, 0 filtered out
```

---

## Testing

**Current state: 14 passing tests, 0 failing.** Run with `snforge test`.

| Test | File | What it verifies |
|---|---|---|
| Full lifecycle | `swap_core_test.cairo` | `post_offer` → `accept_offer` → oracle submit → `settle_epoch` (both directions) → `close_swap`, with correct collateral movements and final balances at each step |
| Cancel offer | `swap_core_test.cairo` | Fixed party cancels unaccepted offer, full collateral returned |
| Double settlement rejection | `swap_core_test.cairo` | Settling the same epoch twice fails with `'epoch already settled'` |
| Oracle rate not found | `swap_core_test.cairo` | Settling before the oracle submits a rate panics with `"oracle rate not found"` |
| Liquidation path | `swap_core_test.cairo` | Variable collateral unable to cover the fixed party's payout force-liquidates and zeroes both balances |
| Mint, transfer, balance | `mock_collateral_token_test.cairo` | Minting, direct transfer, insufficient-balance rejection |
| Allowance-based transfer_from | `mock_collateral_token_test.cairo` | `approve` then `transfer_from` moves funds and decrements the allowance; missing allowance is rejected |
| Oracle submission | `staking_rate_oracle_test.cairo` | Rate calculation correctness, duplicate-epoch rejection, owner-only enforcement, zero-stake rejection |

This covers the swap logic and the collateral token's own correctness.
It does not cover deployment, STRK20 integration, or anything
involving real value — see [Known Gaps](#known-gaps).

---

## Frontend

A Next.js app in [`frontend/`](frontend/) talks directly to the deployed
contracts — no backend, no indexer. Landing page, a market view (reads
every open offer straight from `swap_core`), a create-offer form, and a
dashboard for your own positions, all wired to real wallet transactions
(Argent X / Braavos) against the Sepolia addresses below. See
[`frontend/README.md`](frontend/README.md) to run it.

---

## Deployment

### Testnet — live on Starknet Sepolia

All three contracts are declared and deployed, in dependency order:

| Contract | Address |
|---|---|
| `MockCollateralToken` | [`0x016e27eb35d9faf774600b3cedf2236743fea410c876a4a57d7cbc371c61a245`](https://sepolia.voyager.online/contract/0x016e27eb35d9faf774600b3cedf2236743fea410c876a4a57d7cbc371c61a245) |
| `StakingRateOracle` | [`0x043afc7db2618c4e5a7c886951c1e018bcd72324eb352f360c7bc174af400976`](https://sepolia.voyager.online/contract/0x043afc7db2618c4e5a7c886951c1e018bcd72324eb352f360c7bc174af400976) |
| `SwapCore` | [`0x05842b6f42dbd0f0ceb399795d60b4d4461fb8a48b75ed9161e2b37ea6f51451`](https://sepolia.voyager.online/contract/0x05842b6f42dbd0f0ceb399795d60b4d4461fb8a48b75ed9161e2b37ea6f51451) |

`StakingRateOracle`'s owner is the deploying account — verified by
calling `get_owner()` against the address above, which returns the
deployer's address. No swaps have been posted against this deployment
yet; it exists to prove the contracts declare, deploy, and wire together
correctly on a live network, not as a market with real activity.

Source code is also verified on [Voyager](https://sepolia.voyager.online/)
for all three contracts, so the deployed bytecode is checked against this
repo's actual source rather than trusted blindly.

To redeploy from scratch:

```bash
sncast --account <your-account> -w declare --network sepolia --contract-name MockCollateralToken
sncast --account <your-account> -w deploy --network sepolia --class-hash <mock_token_class_hash>

sncast --account <your-account> -w declare --network sepolia --contract-name StakingRateOracle
sncast --account <your-account> -w deploy --network sepolia --class-hash <oracle_class_hash> --arguments '<owner_address>'

sncast --account <your-account> -w declare --network sepolia --contract-name SwapCore
sncast --account <your-account> -w deploy --network sepolia --class-hash <swap_core_class_hash> --arguments '<mock_token_address>, <oracle_address>'
```

Deploy in dependency order: `mock_collateral_token` → `staking_rate_oracle`
→ `swap_core`, since `swap_core`'s constructor takes the other two
addresses.

### Mainnet path

1. Obtain STRK20 SDK access (currently gated to integration partners —
   see [Known Gaps](#known-gaps)).
2. Replace `mock_collateral_token` with an STRK20 shielded-balance
   adapter behind `i_collateral_token.cairo`. No change to `swap_core.cairo`.
3. Wire `staking_rate_oracle`'s Phase 2 to Starknet's native staking
   contract instead of admin submission.
4. Update the oracle owner to a multisig before any real collateral is at risk.

---

## Security Considerations

**Collateral custody.** All collateral is held in `swap_core` via the
`i_collateral_token` interface. Funds only move on an explicit
settlement, close, cancel, or liquidation call — no admin key can drain
collateral, by construction of the contract (not yet independently
verified by an audit).

**Maintenance margin.** The variable party must maintain collateral above
110% of their remaining obligation at all times. The check runs at the
end of every `settle_epoch` call. If breached, liquidation is immediate.

```
remaining_obligation = remaining_epochs × notional × fixed_rate ÷ 1,000,000
minimum_collateral    = remaining_obligation × 110 ÷ 100
```

**Oracle risk (Phase 1).** The oracle is fully owner-controlled in Phase
1. An owner cannot submit a rate that's internally inconsistent, but
could submit a rate that favours one side, or simply lie about
network-wide staking numbers with nothing on-chain to check them against
yet. Acknowledged limitation. Mitigation path: multisig oracle key, then
Phase 2's direct on-chain read removes owner trust entirely.

**`approve`/`transfer_from` allowance model.** `mock_collateral_token`
uses a standard ERC-20 allowance — `approve` then `transfer_from`. An
earlier version of this contract checked `caller == sender` directly,
which meant `swap_core` could never successfully call `transfer_from` on
a user's behalf: Starknet's `get_caller_address()` returns the
*immediate* caller inside a called contract, so from the token's
perspective the caller was always `swap_core`, never the original user.
Every `post_offer`/`accept_offer` call would have reverted. Fixed by
adding a real allowance system; both parties must
`approve(swap_core_address, amount)` before posting or accepting an
offer.

**Cairo/Starknet safety properties not yet exercised.** Cairo contracts
on Starknet get STARK-provable execution and no reentrancy by default in
typical patterns, but none of that protects against logic bugs in this
specific contract, and none of it has been checked here by any tool —
no static analysis pass, no audit, no fuzzing.

**No upgrade keys.** As designed, `swap_core` has no upgrade mechanism —
intentional: what's deployed is what runs. Not yet reflected in actual
deployed code, because nothing is deployed.

---

## Known Gaps

Consolidated list — the least flattering section in this document,
deliberately, because everything above reads more finished than the code is:

- **STRK20 SDK access is gated and has not been requested.** Public
  reporting describes integration partners working directly with the
  STRK20 team — there is no confirmation of a timeline for this project
  to get access. Tier 1 (see [Privacy Layer](#the-privacy-layer--two-tiers-stated-honestly))
  assumes access that doesn't exist yet.
- **Oracle Phase 2 design is unverified against the real staking
  contract.** The claim that a same-chain cross-contract read is simpler
  than a cross-chain proof is a structural argument, not something
  checked against Starknet's actual staking contract interface.
- **No audit, no static analysis pass, no fuzzing.**

---

## Roadmap

### Phase 1 — Bilateral swap on public collateral (in progress)

- ~~Get `swap_core.cairo`, `staking_rate_oracle.cairo`, and
  `mock_collateral_token.cairo` compiling~~ — done, `scarb build` passes.
- ~~Pass a first test suite covering the full lifecycle and the failure
  paths.~~ — done, 14 passing tests, see [Testing](#testing).
- ~~Resolve the `accept_offer` epoch-start stub against a real epoch
  source.~~ — done, uses `staking_rate_oracle.get_latest_epoch() + 1`.
- ~~Public GitHub repo~~ — done, this README kept in sync with actual
  code state.
- ~~Deploy to testnet~~ — done, live on Starknet Sepolia, see
  [Deployment](#deployment).

### Phase 2 — Trustless oracle

- Replace owner-submitted rates with a direct on-chain read of
  Starknet's native staking contract.
- Remove owner trust from `staking_rate_oracle` entirely.

### Phase 3 — Tier 1 privacy (STRK20 integration)

- Request/obtain STRK20 SDK access.
- Replace `mock_collateral_token` with an STRK20 shielded-balance
  adapter behind `i_collateral_token.cairo` — zero changes to
  `swap_core.cairo`'s logic required.
- Positions and holdings become private between settlements.

### Phase 4 — Tier 2 privacy (research)

- Design, and attempt to implement, a custom Cairo circuit proving
  settlement correctness against hidden notionals with no plaintext
  moment, using SNIP-36's native proof verification directly.
- This is a research problem, not a scheduled deliverable. The honest
  target for an 8-week accelerator program is a design/spec for this
  phase, not a shipped circuit.

### Phase 5 — Liquidity pool

- LP-backed pool automatically takes the variable side for fixed-rate
  offers — no counterparty matching required.
- AMM-style rate pricing based on pool utilisation.

---

## Why Starknet

BTC-staking yield of this specific shape — trustless L2 custody, dual-token
consensus, STRK emissions split against total BTC staked — exists only on
Starknet as of this writing. That alone would make this a Starknet-specific
protocol. But the deeper reason this protocol targets Starknet is that
Starknet is also, as of v0.14.2, the only chain where:

1. **Token-level shielded balances (STRK20)** exist as a primitive to
   build collateral custody on, rather than something this project would
   have to invent.
2. **Native off-chain proof verification (SNIP-36)** is a general
   protocol feature, not something scoped only to STRK20's own use case
   — which is what makes Tier 2 a real, chain-native research direction
   instead of a fantasy.
3. **The yield source and the privacy layer shipped on the same chain,
   months apart**, meaning the hedging problem and the tool to hedge it
   privately became possible at the same time, for the first time,
   anywhere.

Silhouette is not portable to a chain that has BTC-staking yield but no
STRK20-equivalent, or a chain with private tokens but no BTC-staking
yield to hedge. It requires both, on the same chain, which today means
Starknet alone.

---

## Accelerator Context

Silhouette is being prepared as an application to **Proof of Privacy**,
the Starknet Foundation's accelerator for teams building on STRK20
(Cohort 01: applications close July 10, 2026; program runs July 20 –
September 14, 2026). The Foundation's own framing is "practical privacy,
in the truest sense" — privacy applied to a real financial primitive with
a genuine reason to hide the specific data it hides, not privacy for its
own sake. This document's [Privacy Layer](#the-privacy-layer--two-tiers-stated-honestly)
section is written to hold up against that bar honestly: Tier 1 is real
and buildable in the program's timeframe; Tier 2 is named as research,
not oversold as already working.

---

## License

MIT — see [LICENSE](LICENSE)

---

<p align="center">
  Built on Starknet. Shielded by STRK20.
</p>
