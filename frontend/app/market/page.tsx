"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "@starknet-react/core";
import { CairoOption } from "starknet";
import { useContracts } from "@/lib/hooks";
import { CONTRACTS } from "@/lib/contracts";
import { formatUnits, OFFER_STATUS, shortenAddress } from "@/lib/format";
import FAQAccordion from "@/components/FAQAccordion";

interface OfferRow {
  id: number;
  fixedParty: string;
  notional: bigint;
  fixedRateBps: bigint;
  durationEpochs: bigint;
  collateral: bigint;
  status: number;
}

const faqs = [
  {
    q: "What does it mean to accept an offer?",
    a: "You take the floating side of the swap. Each epoch you receive what the actual staking rate earns on the notional, and you owe the fixed rate. If actual beats fixed, you profit. If it falls below, you cover the gap from your collateral.",
  },
  {
    q: "Why do I need to post collateral?",
    a: "You might owe a payment if the rate falls below the fixed rate. Your collateral, held in swap_core, secures the fixed party against that. It must clear a 110% maintenance margin — checked after every settlement, not just at the start.",
  },
  {
    q: "What is the maintenance margin?",
    a: "After every settle_epoch call, the contract checks your remaining collateral against 110% of your remaining obligation for the rest of the swap. If it's below that, the contract liquidates immediately, splitting what's left between both parties.",
  },
  {
    q: "What happens to my collateral during the swap?",
    a: "It stays locked in swap_core. After each epoch settles, your balance adjusts up or down based on the outcome. When every epoch has settled and the swap closes, whatever remains is returned to your wallet.",
  },
];

function AcceptModal({
  offer,
  onClose,
  onAccept,
  busy,
}: {
  offer: OfferRow;
  onClose: () => void;
  onAccept: (amount: bigint) => void;
  busy: boolean;
}) {
  const [amount, setAmount] = useState("");
  const suggested =
    (offer.notional * offer.fixedRateBps * offer.durationEpochs * 110n) /
    (1_000_000n * 100n);
  const amountBig = amount ? BigInt(amount) : 0n;
  const valid = amountBig > 0n;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-bg-raised rounded-lg border border-border-strong shadow-2xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-base text-fg">Accept offer #{offer.id}</h2>
              <p className="text-xs text-fg-faint mt-0.5">
                You take the variable side of this swap.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-fg-faint hover:text-fg transition-colors p-1"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="bg-bg rounded border border-border divide-y divide-border mb-5 text-sm">
            <div className="flex justify-between px-4 py-3">
              <span className="text-fg-faint">Notional</span>
              <span className="font-mono text-fg">{formatUnits(offer.notional)}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-fg-faint">Fixed rate (you owe)</span>
              <span className="font-mono text-accent">
                {offer.fixedRateBps.toString()} bps / epoch
              </span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-fg-faint">Duration</span>
              <span className="font-mono text-fg">
                {offer.durationEpochs.toString()} epochs
              </span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-fg-faint">Suggested min. collateral</span>
              <span className="font-mono text-fg">{formatUnits(suggested)}</span>
            </div>
          </div>

          <label className="block text-xs text-fg mb-1.5">
            Your collateral
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder={suggested.toString()}
            className="w-full bg-bg border border-border rounded px-3 py-2.5 text-sm font-mono text-fg focus:outline-none focus:border-accent mb-1"
          />
          <p className="text-xs text-fg-faint mb-5">
            110% of full-duration obligation is {formatUnits(suggested)} — the
            contract re-checks your margin after every settlement, so more
            gives you more headroom against liquidation.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => onAccept(amountBig)}
              disabled={busy || !valid}
              className="flex-1 bg-fg text-bg text-sm py-2.5 rounded hover:bg-accent transition-colors disabled:opacity-40"
            >
              {busy ? "Confirming…" : "Approve & Accept"}
            </button>
            <button
              onClick={onClose}
              className="px-4 text-sm text-fg-faint hover:text-fg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MarketPage() {
  const { swapCore, collateralToken } = useContracts();
  const { account, address } = useAccount();
  const [offers, setOffers] = useState<OfferRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OfferRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const countRaw = (await swapCore.get_offer_count()) as bigint;
      const count = Number(countRaw);
      const ids = Array.from({ length: count }, (_, i) => i + 1);
      const rows = await Promise.all(
        ids.map(async (id) => {
          const result = (await swapCore.get_offer(id)) as CairoOption<{
            fixed_party: string;
            notional: bigint;
            fixed_rate_bps: bigint;
            duration_epochs: bigint;
            collateral: bigint;
            status: number;
          }>;
          const offer = result.unwrap();
          if (!offer) return null;
          return {
            id,
            fixedParty: offer.fixed_party.toString(),
            notional: BigInt(offer.notional),
            fixedRateBps: BigInt(offer.fixed_rate_bps),
            durationEpochs: BigInt(offer.duration_epochs),
            collateral: BigInt(offer.collateral),
            status: Number(offer.status),
          } satisfies OfferRow;
        }),
      );
      setOffers(rows.filter((r): r is OfferRow => r !== null).reverse());
    } catch (e) {
      console.error(e);
      setError("Couldn't load offers from the contract. See console.");
    }
  }, [swapCore]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount from the chain, not derived from render state
    load();
  }, [load]);

  async function handleAccept(amount: bigint) {
    if (!account || !selected) return;
    try {
      setBusy(true);
      setError(null);
      const approveCall = collateralToken.populate("approve", [
        CONTRACTS.swapCore.address,
        amount,
      ]);
      const acceptCall = swapCore.populate("accept_offer", [
        selected.id,
        amount,
      ]);
      const { transaction_hash } = await account.execute([
        approveCall,
        acceptCall,
      ]);
      setTxHash(transaction_hash);
      await account.waitForTransaction(transaction_hash);
      setSelected(null);
      await load();
    } catch (e) {
      console.error(e);
      setError("Transaction failed. See console for details.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-bg min-h-screen">
      <div className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-medium text-fg mb-2">Open offers</h1>
          <p className="text-fg-dim text-sm max-w-2xl">
            Each row is a fixed-party offer, read live from{" "}
            <code className="text-fg-dim">swap_core</code> — someone who
            locked BTC-staking collateral and wants a fixed rate. Accepting
            takes the variable side: you profit when rates rise above the
            fixed rate, and cover the gap when they fall below it.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex gap-4 bg-accent/[0.06] border border-accent/25 rounded-lg p-5 mb-8">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center mt-0.5">
            <span className="text-accent text-xs">i</span>
          </div>
          <div>
            <p className="text-sm text-fg mb-1">What is a basis point (bps)?</p>
            <p className="text-sm text-fg-dim leading-relaxed">
              1 bps = 1 STRK-unit earned per 1,000,000 sats of BTC staked,
              per epoch. Example: 80 bps on 10,000,000 notional = a fixed
              payment of 800 units per epoch. No price feed needed.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 text-sm text-negative border border-negative/30 rounded p-3">
            {error}
          </div>
        )}

        {txHash && (
          <div className="mb-6 text-xs text-fg-faint border border-border rounded p-3">
            Last transaction:{" "}
            <a
              className="text-accent hover:underline"
              href={`https://sepolia.voyager.online/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {shortenAddress(txHash, 8)}
            </a>
          </div>
        )}

        {offers === null && !error && (
          <p className="text-fg-faint text-sm mb-14">Reading offers from the chain…</p>
        )}

        {offers && offers.length === 0 && (
          <p className="text-fg-faint text-sm mb-14">
            No offers posted yet.{" "}
            <a href="/create" className="text-accent hover:underline">
              Post the first one
            </a>
            .
          </p>
        )}

        {offers && offers.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border mb-14">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-raised">
                  <th className="text-left px-5 py-3.5 text-xs text-fg-faint uppercase tracking-wider">#</th>
                  <th className="text-left px-5 py-3.5 text-xs text-fg-faint uppercase tracking-wider">Fixed party</th>
                  <th className="text-right px-5 py-3.5 text-xs text-fg-faint uppercase tracking-wider">Notional</th>
                  <th className="text-right px-5 py-3.5 text-xs text-fg-faint uppercase tracking-wider">Fixed rate</th>
                  <th className="text-right px-5 py-3.5 text-xs text-fg-faint uppercase tracking-wider">Duration</th>
                  <th className="text-right px-5 py-3.5 text-xs text-fg-faint uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {offers.map((offer) => (
                  <tr key={offer.id} className="hover:bg-bg-raised transition-colors">
                    <td className="px-5 py-4 font-mono text-fg-faint text-xs">{offer.id}</td>
                    <td className="px-5 py-4 font-mono text-fg-dim text-xs">
                      {shortenAddress(offer.fixedParty)}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-fg">
                      {formatUnits(offer.notional)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="bg-accent/10 text-accent font-mono text-xs px-2.5 py-1 rounded-full border border-accent/25">
                        {offer.fixedRateBps.toString()} bps
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-fg-dim text-sm">
                      {offer.durationEpochs.toString()} epochs
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span
                        className={`text-xs px-2 py-1 rounded border ${
                          offer.status === 0
                            ? "border-positive/40 text-positive"
                            : "border-border text-fg-faint"
                        }`}
                      >
                        {OFFER_STATUS[offer.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {offer.status === 0 &&
                        address &&
                        address.toLowerCase() !== offer.fixedParty.toLowerCase() && (
                          <button
                            onClick={() => setSelected(offer)}
                            className="text-xs bg-fg text-bg px-3 py-1.5 rounded hover:bg-accent transition-colors"
                          >
                            Accept
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-border pt-12">
          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <h2 className="text-xl text-fg mb-2">Questions about accepting</h2>
              <p className="text-sm text-fg-dim leading-relaxed">
                What to know before you take the variable side of a swap.
              </p>
            </div>
            <div className="md:col-span-2">
              <FAQAccordion items={faqs} />
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <AcceptModal
          offer={selected}
          onClose={() => setSelected(null)}
          onAccept={handleAccept}
          busy={busy}
        />
      )}
    </div>
  );
}
