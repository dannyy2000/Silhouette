import Link from "next/link";

export default function Home() {
  return (
    <div>
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-24">
        <div className="max-w-2xl">
          <p className="text-xs tracking-widest text-accent uppercase mb-6">
            Sepolia testnet — unaudited
          </p>
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
      </section>

      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-16 grid sm:grid-cols-3 gap-10">
          <div>
            <div className="text-accent text-sm mb-3">01</div>
            <h3 className="text-fg font-medium mb-2">Fixed side</h3>
            <p className="text-fg-dim text-sm leading-relaxed">
              Post an offer specifying a rate, notional, and duration.
              Every epoch, the swap tops up your yield to exactly the
              rate you locked in — regardless of what the network-wide
              rate does.
            </p>
          </div>
          <div>
            <div className="text-accent text-sm mb-3">02</div>
            <h3 className="text-fg font-medium mb-2">Variable side</h3>
            <p className="text-fg-dim text-sm leading-relaxed">
              Accept an offer and take the other side of the bet. You
              collect the excess when the actual rate beats the fixed
              rate, and cover the gap when it doesn&apos;t.
            </p>
          </div>
          <div>
            <div className="text-accent text-sm mb-3">03</div>
            <h3 className="text-fg font-medium mb-2">Nobody else sees it</h3>
            <p className="text-fg-dim text-sm leading-relaxed">
              Once STRK20 integration lands, position size and side are
              visible only to the two counterparties — not the whole
              market watching the chain. See the README for exactly
              what&apos;s private today versus planned.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-fg font-medium mb-6">
            The math, in one line
          </h2>
          <div className="bg-bg-raised border border-border rounded p-6 font-mono text-sm text-fg-dim leading-relaxed overflow-x-auto">
            <div>payment = notional × rate_bps ÷ 1,000,000</div>
            <div className="mt-2 text-fg-faint">
              {"// run once for the fixed rate, once for the actual rate — only the net difference moves"}
            </div>
          </div>
          <p className="text-fg-faint text-sm mt-6 max-w-2xl">
            Neither party moves principal. Only the net difference in
            yield calculations transfers between collateral balances
            each epoch, settled by anyone calling{" "}
            <code className="text-fg-dim">settle_epoch</code> — no
            wallet needs to sign it.
          </p>
        </div>
      </section>
    </div>
  );
}
