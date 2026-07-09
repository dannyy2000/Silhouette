import Link from "next/link";
import FAQAccordion from "@/components/FAQAccordion";

const faqs = [
  {
    q: "What is Starknet's BTC-staking yield?",
    a: "Starknet runs a dual-token consensus model: STRK stake is 75% of the network's security weight, BTC stake is the other 25%. BTC holders stake without giving up custody and receive a share of STRK emissions every epoch. It's a trustless L2 staking mechanism, not a synthetic reward.",
  },
  {
    q: "Why does the rate keep changing?",
    a: "BTC stakers as a group get a fixed 25% share of STRK emissions, but that pool is split across however much BTC is staked network-wide. Stake more BTC and the per-staker rate drops; stake less and it rises. Nobody controls this or can predict it precisely, epoch to epoch.",
  },
  {
    q: "What is an interest rate swap?",
    a: "A contract between two parties where one always pays a fixed rate and the other pays the floating (actual) rate, on the same notional. Only the difference moves each epoch — nobody exchanges the full notional. One party gets certainty, the other gets exposure to rate movement.",
  },
  {
    q: "What is the oracle and why is it needed?",
    a: "swap_core.cairo can't read Starknet's staking contract on its own in this phase. staking_rate_oracle.cairo is the bridge — the owner submits the STRK reward paid and total BTC staked each epoch, and the contract calculates the rate itself. Phase 2 replaces this with a direct on-chain read of Starknet's native staking contract, removing owner trust entirely.",
  },
  {
    q: "What is the collateral token?",
    a: "MockCollateralToken is a fully public, freely mintable testnet stand-in — anyone can mint. It exists so the swap logic has something real to escrow while STRK20 SDK access (for real shielded collateral) is still gated to integration partners. Never intended for mainnet.",
  },
  {
    q: "What happens if collateral runs out?",
    a: "swap_core enforces a maintenance margin — the variable party's collateral must stay above 110% of their remaining obligation at all times. If a settlement pushes them below that, the contract liquidates immediately and returns the correct amounts to both parties. No manual action required.",
  },
  {
    q: "Do I need to act every epoch?",
    a: "No. settle_epoch is permissionless — any address can call it once the oracle has posted that epoch's rate. You only need to act to post an offer, accept one, or close a swap once every epoch has settled.",
  },
];

const lifecycle = [
  {
    step: "01",
    title: "Fixed party posts an offer",
    body: "Sets the fixed rate, notional, and duration, and approves + deposits collateral. Locked in escrow immediately, not transferable until the swap closes.",
  },
  {
    step: "02",
    title: "Variable party accepts",
    body: "Deposits their own collateral. A live swap is created starting the epoch after the oracle's last submitted rate — settle_epoch can never run on an epoch whose rate is already known.",
  },
  {
    step: "03",
    title: "Oracle posts the epoch rate",
    body: "After each staking epoch, the oracle owner submits the STRK reward paid to BTC stakers and the total BTC staked. The contract calculates the rate — the oracle can't manipulate the math itself.",
  },
  {
    step: "04",
    title: "Anyone triggers settlement",
    body: "settle_epoch compares fixed vs. actual rate on the notional, moves only the net difference between collateral balances, and checks the variable party's 110% maintenance margin.",
  },
  {
    step: "05",
    title: "Swap closes, collateral returns",
    body: "Once every epoch in the duration has settled, anyone can call close_swap. Each party receives whatever collateral balance remains.",
  },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-24 md:py-32">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 text-xs font-medium text-accent border border-accent/30 bg-accent/10 px-3 py-1.5 rounded-full mb-8 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
              Live on Starknet Sepolia
            </span>
            <h1 className="text-4xl sm:text-5xl font-medium leading-tight text-fg mb-6">
              Lock in your BTC-staking rate.
              <br />
              <span className="text-fg-dim">Keep the position private.</span>
            </h1>
            <p className="text-fg-dim text-lg leading-relaxed mb-10">
              Starknet pays STRK to BTC stakers every epoch, but the rate
              moves with total BTC staked network-wide. Silhouette is an
              interest rate swap: one party locks in a fixed rate, a
              counterparty takes the floating side, and a smart contract
              settles the difference automatically — every epoch, no
              manual claiming.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/market"
                className="px-5 py-2.5 bg-fg text-bg text-sm rounded hover:bg-accent transition-colors"
              >
                View the market
              </Link>
              <Link
                href="/create"
                className="px-5 py-2.5 border border-border-strong text-fg text-sm rounded hover:border-accent hover:text-accent transition-colors"
              >
                Post a fixed-rate offer
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Why it exists */}
      <section className="border-b border-border bg-bg-raised">
        <div className="max-w-5xl mx-auto px-6 py-16 grid sm:grid-cols-3 gap-8">
          {[
            {
              label: "The yield is real",
              body: "BTC stakers receive real STRK emissions every epoch through Starknet's own dual-token consensus — a trustless L2 staking mechanism, not a synthetic wrapper.",
            },
            {
              label: "The problem is real",
              body: "The rate moves with total BTC staked network-wide. One epoch it's 80 bps, the next 55, the one after 95 — no way to plan around it until now.",
            },
            {
              label: "Nobody's built this yet",
              body: "Pendle's Boros does the same thing for ETH funding rates and clears ~$2.9B a month. Nothing equivalent — private or public — exists for Starknet's BTC-staking yield.",
            },
          ].map((c) => (
            <div key={c.label} className="bg-bg border border-border rounded-lg p-6">
              <h3 className="text-sm font-medium text-fg mb-2">{c.label}</h3>
              <p className="text-sm text-fg-dim leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <h2 className="text-2xl font-medium text-fg mb-3">How a swap works</h2>
            <p className="text-fg-dim text-sm max-w-lg mx-auto">
              Two parties. One fixed rate. One floating rate. The contract
              handles everything automatically.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-16">
            <div className="rounded-lg border border-accent/30 bg-accent/[0.06] p-8">
              <div className="inline-block bg-accent/15 border border-accent/30 text-accent text-xs font-medium uppercase tracking-widest px-3 py-1 rounded-full mb-5">
                Fixed party — the hedger
              </div>
              <h3 className="text-lg text-fg mb-3">You want certainty.</h3>
              <p className="text-fg-dim text-sm leading-relaxed mb-4">
                You&apos;re staking BTC on Starknet and hate not knowing what
                yield you&apos;ll actually receive. You post a swap offer
                with a fixed rate you&apos;re happy with.
              </p>
              <p className="text-fg-dim text-sm leading-relaxed mb-4">
                Every epoch, the swap tops you up if the actual rate falls
                below your fixed rate, and passes your excess to the
                variable party if it rises above it.
              </p>
              <div className="bg-bg rounded border border-accent/20 px-4 py-3">
                <p className="text-xs text-accent">Your outcome every epoch:</p>
                <p className="text-sm text-fg mt-1">
                  Exactly the fixed rate — no matter what the network pays.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border-strong bg-bg-raised p-8">
              <div className="inline-block bg-bg-raised-2 border border-border-strong text-fg-dim text-xs font-medium uppercase tracking-widest px-3 py-1 rounded-full mb-5">
                Variable party — the speculator
              </div>
              <h3 className="text-lg text-fg mb-3">You want exposure.</h3>
              <p className="text-fg-dim text-sm leading-relaxed mb-4">
                You think the BTC-staking rate is rising, or want direct
                exposure to it without staking BTC yourself. You accept an
                open offer and deposit collateral.
              </p>
              <p className="text-fg-dim text-sm leading-relaxed mb-4">
                When the actual rate beats the fixed rate, you pocket the
                difference. When it falls below, you cover the gap from
                your collateral.
              </p>
              <div className="bg-bg rounded border border-border px-4 py-3">
                <p className="text-xs text-fg-faint">Your outcome every epoch:</p>
                <p className="text-sm text-fg mt-1">
                  The actual rate minus the fixed rate. You win when rates
                  rise.
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-2xl mx-auto">
            <h3 className="text-xs text-fg-faint uppercase tracking-widest mb-8 text-center">
              The lifecycle — step by step
            </h3>
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
              {lifecycle.map((s) => (
                <div key={s.step} className="relative flex gap-6 pb-10 last:pb-0">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-bg border border-border-strong flex items-center justify-center relative z-10">
                    <span className="text-xs text-fg-dim">{s.step}</span>
                  </div>
                  <div className="pt-1.5 pb-2">
                    <h4 className="text-sm text-fg mb-1">{s.title}</h4>
                    <p className="text-sm text-fg-dim leading-relaxed">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* The math */}
      <section className="border-b border-border bg-bg-raised">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <h2 className="text-2xl font-medium text-fg mb-4">
                Every number is on-chain.
              </h2>
              <p className="text-fg-dim text-sm leading-relaxed mb-8">
                No external price feed. The rate comes from two numbers
                that are publicly readable on Starknet, and the contract
                calculates everything itself.
              </p>
              <div className="space-y-4">
                <div className="bg-bg rounded border border-border p-5">
                  <p className="text-xs text-fg-faint uppercase tracking-widest mb-3">
                    Rate formula
                  </p>
                  <code className="block text-sm font-mono text-fg mb-2">
                    rate_bps = strk_reward × 1,000,000
                    <br />
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;÷ total_btc_staked
                  </code>
                  <p className="text-xs text-fg-faint">
                    STRK-units earned per 1,000,000 sats of BTC staked, per epoch.
                  </p>
                </div>
                <div className="bg-bg rounded border border-border p-5">
                  <p className="text-xs text-fg-faint uppercase tracking-widest mb-3">
                    Settlement formula
                  </p>
                  <code className="block text-sm font-mono text-fg mb-2">
                    payment = notional × rate_bps
                    <br />
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;÷ 1,000,000
                  </code>
                  <p className="text-xs text-fg-faint">
                    Run at fixed rate and actual rate. Only the net difference moves.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs text-fg-faint uppercase tracking-widest mb-5">
                Worked example
              </h3>
              <div className="bg-bg rounded-lg border border-border overflow-hidden">
                <div className="px-6 py-4 bg-bg-raised-2 border-b border-border">
                  <p className="text-sm text-fg-dim">
                    Fixed rate: 80 bps · Notional: 10,000,000
                  </p>
                </div>
                <div className="divide-y divide-border">
                  <div className="px-6 py-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="text-xs text-fg-faint uppercase tracking-wider mb-1">
                          Epoch A — staking participation drops
                        </p>
                        <p className="text-sm text-fg-dim">
                          Actual rate: <span className="font-mono text-fg">100 bps</span>
                        </p>
                      </div>
                      <span className="flex-shrink-0 text-xs bg-accent/10 text-accent border border-accent/30 px-2.5 py-1 rounded-full">
                        Variable wins
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-bg-raised rounded p-3">
                        <p className="text-fg-faint mb-1">Fixed payment owed</p>
                        <p className="font-mono text-fg">800 units</p>
                      </div>
                      <div className="bg-bg-raised rounded p-3">
                        <p className="text-fg-faint mb-1">Variable receives</p>
                        <p className="font-mono text-fg">+200 net</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="text-xs text-fg-faint uppercase tracking-wider mb-1">
                          Epoch B — staking participation rises
                        </p>
                        <p className="text-sm text-fg-dim">
                          Actual rate: <span className="font-mono text-fg">55 bps</span>
                        </p>
                      </div>
                      <span className="flex-shrink-0 text-xs bg-positive/10 text-positive border border-positive/30 px-2.5 py-1 rounded-full">
                        Fixed wins
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-bg-raised rounded p-3">
                        <p className="text-fg-faint mb-1">Fixed receives top-up</p>
                        <p className="font-mono text-fg">+250 net</p>
                      </div>
                      <div className="bg-bg-raised rounded p-3">
                        <p className="text-fg-faint mb-1">Variable pays gap</p>
                        <p className="font-mono text-fg">-250</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 bg-accent/[0.06] border-t border-accent/20">
                  <p className="text-xs text-accent/90">
                    In both epochs the fixed party nets exactly{" "}
                    <strong>800 units</strong> — their agreed rate —
                    regardless of what the network paid.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy note */}
      <section className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-medium text-fg mb-4">
            Nobody else sees it — eventually
          </h2>
          <p className="text-fg-dim text-sm leading-relaxed max-w-2xl mb-4">
            Today, collateral moves through a fully public mock token —
            this deployment is a swap-logic proof, not a privacy proof.
            Once STRK20 SDK access lands, collateral shifts to a shielded
            balance behind the same interface, with zero changes to the
            settlement logic: position size and side become visible only
            to the two counterparties, not the whole market watching the
            chain.
          </p>
          <p className="text-fg-faint text-xs max-w-2xl">
            Full two-tier breakdown (what&apos;s buildable now vs. the
            research direction) is in the repo README.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-b border-border bg-bg-raised-2">
        <div className="max-w-5xl mx-auto px-6 py-16 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-xl text-fg mb-1">Ready to try it?</h2>
            <p className="text-fg-dim text-sm">
              Connect a Starknet wallet. Takes under two minutes.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/market"
              className="bg-fg text-bg text-sm px-6 py-3 rounded hover:bg-accent transition-colors"
            >
              View market
            </Link>
            <Link
              href="/create"
              className="border border-border-strong text-fg-dim text-sm px-6 py-3 rounded hover:border-accent hover:text-accent transition-colors"
            >
              Post offer
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <div className="max-w-5xl mx-auto px-6 py-20">
          <div className="grid md:grid-cols-3 gap-16">
            <div>
              <h2 className="text-xl text-fg mb-3">Common questions</h2>
              <p className="text-sm text-fg-dim leading-relaxed">
                Everything you need to understand before your first swap.
                Click any question to expand.
              </p>
            </div>
            <div className="md:col-span-2">
              <FAQAccordion items={faqs} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
