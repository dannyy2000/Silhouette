"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "@starknet-react/core";
import { CairoOption } from "starknet";
import { useContracts } from "@/lib/hooks";
import { formatUnits, OFFER_STATUS, SWAP_STATUS } from "@/lib/format";

interface OfferRow {
  id: number;
  notional: bigint;
  fixedRateBps: bigint;
  durationEpochs: bigint;
  collateral: bigint;
  status: number;
}

interface SwapRow {
  id: number;
  role: "fixed" | "variable";
  notional: bigint;
  fixedRateBps: bigint;
  durationEpochs: bigint;
  startEpoch: bigint;
  epochsSettled: bigint;
  fixedCollateral: bigint;
  variableCollateral: bigint;
  status: number;
}

export default function DashboardPage() {
  const { swapCore } = useContracts();
  const { account, address, status: accountStatus } = useAccount();

  const [myOffers, setMyOffers] = useState<OfferRow[]>([]);
  const [mySwaps, setMySwaps] = useState<SwapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const offerCount = Number(await swapCore.get_offer_count());
      const swapCount = Number(await swapCore.get_swap_count());

      const offerResults = await Promise.all(
        Array.from({ length: offerCount }, (_, i) => i + 1).map(async (id) => {
          const res = (await swapCore.get_offer(id)) as CairoOption<{
            fixed_party: string;
            notional: bigint;
            fixed_rate_bps: bigint;
            duration_epochs: bigint;
            collateral: bigint;
            status: number;
          }>;
          const o = res.unwrap();
          if (!o) return null;
          if (o.fixed_party.toString().toLowerCase() !== address.toLowerCase())
            return null;
          return {
            id,
            notional: BigInt(o.notional),
            fixedRateBps: BigInt(o.fixed_rate_bps),
            durationEpochs: BigInt(o.duration_epochs),
            collateral: BigInt(o.collateral),
            status: Number(o.status),
          } satisfies OfferRow;
        }),
      );

      const swapResults = await Promise.all(
        Array.from({ length: swapCount }, (_, i) => i + 1).map(async (id) => {
          const res = (await swapCore.get_swap(id)) as CairoOption<{
            fixed_party: string;
            variable_party: string;
            notional: bigint;
            fixed_rate_bps: bigint;
            duration_epochs: bigint;
            start_epoch: bigint;
            epochs_settled: bigint;
            fixed_collateral: bigint;
            variable_collateral: bigint;
            status: number;
          }>;
          const s = res.unwrap();
          if (!s) return null;
          const isFixed =
            s.fixed_party.toString().toLowerCase() === address.toLowerCase();
          const isVariable =
            s.variable_party.toString().toLowerCase() === address.toLowerCase();
          if (!isFixed && !isVariable) return null;
          return {
            id,
            role: isFixed ? "fixed" : "variable",
            notional: BigInt(s.notional),
            fixedRateBps: BigInt(s.fixed_rate_bps),
            durationEpochs: BigInt(s.duration_epochs),
            startEpoch: BigInt(s.start_epoch),
            epochsSettled: BigInt(s.epochs_settled),
            fixedCollateral: BigInt(s.fixed_collateral),
            variableCollateral: BigInt(s.variable_collateral),
            status: Number(s.status),
          } satisfies SwapRow;
        }),
      );

      setMyOffers(offerResults.filter((r): r is OfferRow => r !== null).reverse());
      setMySwaps(swapResults.filter((r): r is SwapRow => r !== null).reverse());
    } catch (e) {
      console.error(e);
      setError("Couldn't load your positions from the contract.");
    } finally {
      setLoading(false);
    }
  }, [swapCore, address]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount from the chain, not derived from render state
    load();
  }, [load]);

  async function cancelOffer(offerId: number) {
    if (!account) return;
    setBusyAction(`cancel-${offerId}`);
    try {
      const { transaction_hash } = await account.execute(
        swapCore.populate("cancel_offer", [offerId]),
      );
      await account.waitForTransaction(transaction_hash);
      await load();
    } catch (e) {
      console.error(e);
      setError("Cancel failed. See console.");
    } finally {
      setBusyAction(null);
    }
  }

  async function settleEpoch(swapId: number, epoch: bigint) {
    if (!account) return;
    setBusyAction(`settle-${swapId}`);
    try {
      const { transaction_hash } = await account.execute(
        swapCore.populate("settle_epoch", [swapId, epoch]),
      );
      await account.waitForTransaction(transaction_hash);
      await load();
    } catch (e) {
      console.error(e);
      setError("Settlement failed — the oracle may not have posted this epoch's rate yet.");
    } finally {
      setBusyAction(null);
    }
  }

  async function closeSwap(swapId: number) {
    if (!account) return;
    setBusyAction(`close-${swapId}`);
    try {
      const { transaction_hash } = await account.execute(
        swapCore.populate("close_swap", [swapId]),
      );
      await account.waitForTransaction(transaction_hash);
      await load();
    } catch (e) {
      console.error(e);
      setError("Close failed. See console.");
    } finally {
      setBusyAction(null);
    }
  }

  if (accountStatus !== "connected") {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <h1 className="text-xl text-fg mb-3">Connect a wallet to see your positions</h1>
        <p className="text-fg-dim text-sm">
          Your dashboard reads directly from the contract, filtered to
          offers and swaps where you&apos;re a party.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <h1 className="text-2xl font-medium text-fg mb-2">Dashboard</h1>
      <p className="text-fg-dim text-sm mb-10">
        Positions where {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "you"} is a party.
      </p>

      {error && (
        <div className="mb-6 text-sm text-negative border border-negative/30 rounded p-3">
          {error}
        </div>
      )}

      {loading && <p className="text-fg-faint text-sm">Loading…</p>}

      <section className="mb-12">
        <h2 className="text-sm text-fg-faint uppercase tracking-wide mb-4">
          Your offers ({myOffers.length})
        </h2>
        {myOffers.length === 0 && !loading && (
          <p className="text-fg-faint text-sm">No offers posted from this wallet yet.</p>
        )}
        <div className="space-y-3">
          {myOffers.map((offer) => (
            <div key={offer.id} className="border border-border rounded p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm text-fg">
                  #{offer.id} — {offer.fixedRateBps.toString()} bps on{" "}
                  {formatUnits(offer.notional)}, {offer.durationEpochs.toString()} epochs
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-1 rounded border border-border text-fg-faint">
                    {OFFER_STATUS[offer.status]}
                  </span>
                  {offer.status === 0 && (
                    <button
                      onClick={() => cancelOffer(offer.id)}
                      disabled={busyAction === `cancel-${offer.id}`}
                      className="text-xs border border-border-strong rounded px-3 py-1.5 hover:border-negative hover:text-negative transition-colors disabled:opacity-40"
                    >
                      {busyAction === `cancel-${offer.id}` ? "Cancelling…" : "Cancel"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm text-fg-faint uppercase tracking-wide mb-4">
          Your swaps ({mySwaps.length})
        </h2>
        {mySwaps.length === 0 && !loading && (
          <p className="text-fg-faint text-sm">No active swaps for this wallet.</p>
        )}
        <div className="space-y-3">
          {mySwaps.map((swap) => {
            const nextEpoch = swap.startEpoch + swap.epochsSettled;
            const allSettled = swap.epochsSettled === swap.durationEpochs;
            return (
              <div key={swap.id} className="border border-border rounded p-5">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                  <div className="text-sm text-fg">
                    #{swap.id} — {swap.role === "fixed" ? "Fixed" : "Variable"} side,{" "}
                    {swap.fixedRateBps.toString()} bps on {formatUnits(swap.notional)}
                  </div>
                  <span className="text-xs px-2 py-1 rounded border border-border text-fg-faint">
                    {SWAP_STATUS[swap.status]}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-2 text-sm mb-4">
                  <div>
                    <div className="text-fg-faint text-xs mb-1">Epochs settled</div>
                    <div className="text-fg">
                      {swap.epochsSettled.toString()} / {swap.durationEpochs.toString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-fg-faint text-xs mb-1">Fixed collateral</div>
                    <div className="text-fg">{formatUnits(swap.fixedCollateral)}</div>
                  </div>
                  <div>
                    <div className="text-fg-faint text-xs mb-1">Variable collateral</div>
                    <div className="text-fg">{formatUnits(swap.variableCollateral)}</div>
                  </div>
                </div>
                {swap.status === 0 && (
                  <div className="flex flex-wrap gap-3 pt-3 border-t border-border">
                    {!allSettled ? (
                      <button
                        onClick={() => settleEpoch(swap.id, nextEpoch)}
                        disabled={busyAction === `settle-${swap.id}`}
                        className="text-xs border border-border-strong rounded px-3 py-1.5 hover:border-accent hover:text-accent transition-colors disabled:opacity-40"
                      >
                        {busyAction === `settle-${swap.id}`
                          ? "Settling…"
                          : `Settle epoch ${nextEpoch.toString()}`}
                      </button>
                    ) : (
                      <button
                        onClick={() => closeSwap(swap.id)}
                        disabled={busyAction === `close-${swap.id}`}
                        className="text-xs border border-border-strong rounded px-3 py-1.5 hover:border-accent hover:text-accent transition-colors disabled:opacity-40"
                      >
                        {busyAction === `close-${swap.id}` ? "Closing…" : "Close swap"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
