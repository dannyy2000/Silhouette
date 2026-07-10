"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "@starknet-react/core";
import { useContracts } from "@/lib/hooks";
import { CONTRACTS } from "@/lib/contracts";
import FAQAccordion from "@/components/FAQAccordion";

const faqs = [
  {
    q: "What is notional?",
    a: "Notional is the reference amount used to calculate payments — similar to the face value of a bond. It never actually moves between wallets. Payments are calculated each epoch as: notional × rate ÷ 1,000,000. A notional of 10,000,000 at 80 bps = 800 units per epoch.",
  },
  {
    q: "How do I choose the right fixed rate?",
    a: "Check recent epochs on the deployed StakingRateOracle to see where rates have been sitting. Set your rate slightly below recent averages for an easy fill, or at the current rate for full protection. If it's too high, the offer may sit unfilled.",
  },
  {
    q: "Why is there a recommended collateral amount?",
    a: "Your collateral must cover what you might owe the variable party if the actual rate stays below your fixed rate for the full duration — plus a buffer. We suggest 150% of the maximum obligation.",
  },
  {
    q: "What is an epoch?",
    a: "Starknet's own staking epoch — about 1 hour on mainnet, ~20 minutes on Sepolia (per docs.starknet.io), much shorter than a Stacks PoX cycle. Right now the oracle tracks epochs as a manually-incremented counter, not wall-clock time directly, so a swap's actual duration depends on how often the oracle owner submits rates, not a hardcoded timer. A swap with a duration of 6 epochs runs for 6 completed epochs of the oracle posting a rate and settle_epoch being called.",
  },
  {
    q: "Can I cancel after posting?",
    a: "Yes — as long as no one has accepted it yet. Go to your Dashboard and cancel it there. Your full collateral is returned immediately, in the same transaction.",
  },
];

function Field({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-fg uppercase tracking-widest mb-2">
        {label}
      </span>
      <input
        {...props}
        className="w-full bg-bg border border-border rounded px-4 py-3 text-sm font-mono text-fg focus:outline-none focus:border-accent"
      />
      {hint && <span className="block text-xs text-fg-faint mt-2">{hint}</span>}
    </label>
  );
}

export default function CreatePage() {
  const { account, status } = useAccount();
  const { swapCore, collateralToken } = useContracts();

  const [notional, setNotional] = useState("10000000");
  const [fixedRateBps, setFixedRateBps] = useState("80");
  const [durationEpochs, setDurationEpochs] = useState("6");
  const [collateral, setCollateral] = useState("5000000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const n = BigInt(notional || "0");
  const r = BigInt(fixedRateBps || "0");
  const d = BigInt(durationEpochs || "0");

  const fixedPaymentPerEpoch = n && r ? (n * r) / 1_000_000n : null;
  const totalFixedObligation = fixedPaymentPerEpoch && d ? fixedPaymentPerEpoch * d : null;
  const recommendedCollateral = totalFixedObligation
    ? (totalFixedObligation * 150n) / 100n
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    setBusy(true);
    setError(null);
    setTxHash(null);

    try {
      const approveCall = collateralToken.populate("approve", [
        CONTRACTS.swapCore.address,
        BigInt(collateral),
      ]);
      const postCall = swapCore.populate("post_offer", [
        n,
        r,
        d,
        BigInt(collateral),
      ]);
      const { transaction_hash } = await account.execute([
        approveCall,
        postCall,
      ]);
      await account.waitForTransaction(transaction_hash);
      setTxHash(transaction_hash);
    } catch (err) {
      console.error(err);
      setError("Transaction failed. Check the console and your wallet.");
    } finally {
      setBusy(false);
    }
  }

  if (status !== "connected") {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <h1 className="text-xl text-fg mb-3">Connect a wallet to post an offer</h1>
        <p className="text-fg-dim text-sm">
          Use the connect button in the top right. You&apos;ll need a
          Starknet Sepolia wallet (Argent X or Braavos) with some testnet
          collateral — mint it via <code className="text-fg-dim">mint</code>{" "}
          on the MockCollateralToken contract.
        </p>
      </div>
    );
  }

  if (txHash) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-positive/10 border-2 border-positive/30 flex items-center justify-center mx-auto mb-5">
            <span className="text-positive text-xl">✓</span>
          </div>
          <h1 className="text-2xl text-fg mb-2">Offer posted</h1>
          <p className="text-sm text-fg-dim leading-relaxed mb-8">
            Your fixed-rate offer is live on Silhouette. Once a variable
            party accepts, a swap starts from the next epoch after the
            oracle&apos;s last submitted rate.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/market"
              className="bg-fg text-bg px-5 py-2.5 rounded text-sm hover:bg-accent transition-colors"
            >
              View market
            </Link>
            <Link
              href="/dashboard"
              className="border border-border-strong text-fg-dim px-5 py-2.5 rounded text-sm hover:border-accent hover:text-accent transition-colors"
            >
              Dashboard
            </Link>
          </div>
          <a
            href={`https://sepolia.voyager.online/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-6 text-xs text-fg-faint hover:text-accent transition-colors"
          >
            View transaction ↗
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-medium text-fg mb-2">Post a fixed-rate offer</h1>
          <p className="text-sm text-fg-dim max-w-xl">
            You&apos;re taking the fixed side. You lock in a rate
            you&apos;re comfortable with. If the actual rate falls below it
            each epoch, the variable party tops you up; if it rises, you
            pass the excess to them. No principal changes hands.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid lg:grid-cols-5 gap-10 items-start">
          <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-6">
            <Field
              label="Notional"
              hint="Sats-denominated BTC notional the rate is applied to. Never moves."
              value={notional}
              onChange={(e) => setNotional(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="10000000"
            />
            <Field
              label="Fixed rate (bps)"
              hint="STRK-units per 1,000,000 sats staked, per epoch."
              value={fixedRateBps}
              onChange={(e) => setFixedRateBps(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="80"
            />
            <Field
              label="Duration (epochs)"
              hint={d > 0n ? `Runs for ${d.toString()} settled epochs.` : "How many epochs this swap runs."}
              value={durationEpochs}
              onChange={(e) => setDurationEpochs(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="6"
            />
            <Field
              label="Your collateral"
              hint={
                recommendedCollateral
                  ? `Recommended: ${recommendedCollateral.toLocaleString()} (150% of max obligation).`
                  : "Locked immediately via approve + transfer_from."
              }
              value={collateral}
              onChange={(e) => setCollateral(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="5000000"
            />

            {error && <p className="text-sm text-negative">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-fg text-bg py-3.5 rounded text-sm hover:bg-accent transition-colors disabled:opacity-40"
            >
              {busy ? "Confirming in wallet…" : "Approve & Post Offer"}
            </button>
          </form>

          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xs text-fg-faint uppercase tracking-widest">
              Live payment preview
            </h2>

            <div className="bg-bg-raised rounded-lg border border-border overflow-hidden">
              <div className="divide-y divide-border">
                {[
                  {
                    label: "Fixed payment / epoch",
                    value: fixedPaymentPerEpoch !== null ? fixedPaymentPerEpoch.toLocaleString() : "—",
                  },
                  {
                    label: "Total fixed obligation",
                    value: totalFixedObligation !== null ? totalFixedObligation.toLocaleString() : "—",
                  },
                  {
                    label: "Duration",
                    value: d > 0n ? `${d.toString()} epochs` : "—",
                  },
                  {
                    label: "Recommended collateral",
                    value: recommendedCollateral !== null ? recommendedCollateral.toLocaleString() : "—",
                  },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center px-5 py-3.5">
                    <span className="text-xs text-fg-faint">{row.label}</span>
                    <span
                      className={`text-sm font-mono ${row.value === "—" ? "text-fg-faint" : "text-fg"}`}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="bg-accent/[0.06] border-t border-accent/20 px-5 py-4">
                <p className="text-xs text-accent/90 leading-relaxed">
                  When actual rate &gt; fixed rate, the variable party
                  pockets the excess. When actual rate &lt; fixed rate,
                  they top you up. You always net your fixed rate.
                </p>
              </div>
            </div>

            <div className="bg-bg-raised rounded-lg border border-border p-5">
              <h3 className="text-xs text-fg uppercase tracking-widest mb-3">
                What happens to your collateral?
              </h3>
              <div className="space-y-3 text-xs text-fg-dim leading-relaxed">
                <div className="flex gap-2">
                  <span className="w-4 h-4 rounded-full bg-bg-raised-2 flex-shrink-0 flex items-center justify-center text-fg-faint">
                    1
                  </span>
                  <p>Locked in swap_core when you post.</p>
                </div>
                <div className="flex gap-2">
                  <span className="w-4 h-4 rounded-full bg-bg-raised-2 flex-shrink-0 flex items-center justify-center text-fg-faint">
                    2
                  </span>
                  <p>Adjusts each epoch based on who won the settlement.</p>
                </div>
                <div className="flex gap-2">
                  <span className="w-4 h-4 rounded-full bg-bg-raised-2 flex-shrink-0 flex items-center justify-center text-fg-faint">
                    3
                  </span>
                  <p>Returned to your wallet when the swap closes.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-10 border-t border-border">
          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <h2 className="text-xl text-fg mb-2">Before you post</h2>
              <p className="text-sm text-fg-dim leading-relaxed">
                Common questions about posting a fixed-rate offer.
              </p>
            </div>
            <div className="md:col-span-2">
              <FAQAccordion items={faqs} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
