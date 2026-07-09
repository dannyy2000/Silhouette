"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "@starknet-react/core";
import { CairoOption } from "starknet";
import { useContracts } from "@/lib/hooks";
import { formatUnits, OFFER_STATUS, SWAP_STATUS, shortenAddress } from "@/lib/format";

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

function Badge({ text, tone }: { text: string; tone: "accent" | "positive" | "neutral" }) {
  const cls = {
    accent: "bg-accent/10 text-accent border-accent/30",
    positive: "bg-positive/10 text-positive border-positive/30",
    neutral: "bg-bg-raised-2 text-fg-faint border-border",
  }[tone];
  return (
    <span className={`text-xs border px-2 py-0.5 rounded ${cls}`}>{text}</span>
  );
}

function ConnectPrompt() {
  return (
    <div className="border border-border rounded-lg p-10 text-center max-w-sm mx-auto mt-16">
      <h2 className="text-base text-fg mb-2">Connect your wallet</h2>
      <p className="text-sm text-fg-dim">
        Connect with Argent X or Braavos, using the button in the top
        right, to view your active positions and open offers.
      </p>
    </div>
  );
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
      setError(
        "Settlement failed — the oracle may not have posted this epoch's rate yet.",
      );
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
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-medium text-fg mb-2">Dashboard</h1>
        <p className="text-sm text-fg-dim mb-6">
          Your active swaps, open offers, and their live status.
        </p>
        <ConnectPrompt />
      </div>
    );
  }

  const activeSwaps = mySwaps.filter((s) => s.status === 0).length;
  const openOffers = myOffers.filter((o) => o.status === 0).length;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-14">
      <div>
        <h1 className="text-3xl font-medium text-fg mb-1">Dashboard</h1>
        <p className="text-sm text-fg-faint font-mono">
          {address && shortenAddress(address, 6)}
        </p>
      </div>

      {error && (
        <div className="text-sm text-negative border border-negative/30 rounded p-3">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="border border-border rounded-lg p-5">
          <p className="text-xs text-fg-faint uppercase tracking-widest mb-1">
            Active swaps
          </p>
          <p className="text-3xl text-fg">{activeSwaps}</p>
        </div>
        <div className="border border-border rounded-lg p-5">
          <p className="text-xs text-fg-faint uppercase tracking-widest mb-1">
            Open offers
          </p>
          <p className="text-3xl text-fg">{openOffers}</p>
        </div>
      </div>

      {loading && <p className="text-fg-faint text-sm">Loading…</p>}

      <section>
        <h2 className="text-lg text-fg mb-1">Your swaps</h2>
        <p className="text-sm text-fg-dim mb-4">
          Collateral balances update after each settled epoch.
        </p>
        {mySwaps.length === 0 && !loading ? (
          <p className="text-fg-faint text-sm">No swaps for this wallet yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-raised border-b border-border">
                  <th className="text-left px-4 py-3 text-xs text-fg-faint uppercase tracking-wider">Swap</th>
                  <th className="text-left px-4 py-3 text-xs text-fg-faint uppercase tracking-wider">Role</th>
                  <th className="text-right px-4 py-3 text-xs text-fg-faint uppercase tracking-wider">Notional</th>
                  <th className="text-right px-4 py-3 text-xs text-fg-faint uppercase tracking-wider">Rate</th>
                  <th className="text-right px-4 py-3 text-xs text-fg-faint uppercase tracking-wider">Progress</th>
                  <th className="text-right px-4 py-3 text-xs text-fg-faint uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mySwaps.map((swap) => {
                  const nextEpoch = swap.startEpoch + swap.epochsSettled;
                  const allSettled = swap.epochsSettled === swap.durationEpochs;
                  return (
                    <tr key={swap.id} className="hover:bg-bg-raised transition-colors">
                      <td className="px-4 py-3.5 font-mono text-fg-faint">#{swap.id}</td>
                      <td className="px-4 py-3.5">
                        <Badge
                          text={swap.role === "fixed" ? "Fixed" : "Variable"}
                          tone={swap.role === "fixed" ? "accent" : "neutral"}
                        />
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-fg">
                        {formatUnits(swap.notional)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-fg">
                        {swap.fixedRateBps.toString()} bps
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-fg-dim font-mono">
                          {swap.epochsSettled.toString()}/{swap.durationEpochs.toString()}
                        </span>
                        <div className="w-16 h-1 bg-bg-raised-2 rounded-full mt-1.5 ml-auto">
                          <div
                            className="h-1 bg-accent rounded-full"
                            style={{
                              width: `${
                                swap.durationEpochs > 0n
                                  ? Number((swap.epochsSettled * 100n) / swap.durationEpochs)
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Badge
                          text={SWAP_STATUS[swap.status]}
                          tone={swap.status === 2 ? "neutral" : "positive"}
                        />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {swap.status === 0 &&
                          (!allSettled ? (
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
                              className="text-xs bg-positive/10 text-positive border border-positive/30 rounded px-3 py-1.5 hover:bg-positive/20 transition-colors disabled:opacity-40"
                            >
                              {busyAction === `close-${swap.id}` ? "Closing…" : "Close swap"}
                            </button>
                          ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg text-fg mb-1">Your open offers</h2>
        <p className="text-sm text-fg-dim mb-4">
          Offers waiting for a variable party to accept. Cancel any of
          these to reclaim your collateral immediately.
        </p>
        {myOffers.length === 0 && !loading ? (
          <p className="text-fg-faint text-sm">No offers posted from this wallet yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-raised border-b border-border">
                  <th className="text-left px-4 py-3 text-xs text-fg-faint uppercase tracking-wider">Offer</th>
                  <th className="text-right px-4 py-3 text-xs text-fg-faint uppercase tracking-wider">Notional</th>
                  <th className="text-right px-4 py-3 text-xs text-fg-faint uppercase tracking-wider">Fixed rate</th>
                  <th className="text-right px-4 py-3 text-xs text-fg-faint uppercase tracking-wider">Duration</th>
                  <th className="text-right px-4 py-3 text-xs text-fg-faint uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {myOffers.map((offer) => (
                  <tr key={offer.id} className="hover:bg-bg-raised transition-colors">
                    <td className="px-4 py-3.5 font-mono text-fg-faint">#{offer.id}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-fg">
                      {formatUnits(offer.notional)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="bg-accent/10 text-accent font-mono text-xs px-2 py-0.5 rounded border border-accent/25">
                        {offer.fixedRateBps.toString()} bps
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-fg-dim">
                      {offer.durationEpochs.toString()} epochs
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Badge text={OFFER_STATUS[offer.status]} tone="neutral" />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {offer.status === 0 && (
                        <button
                          onClick={() => cancelOffer(offer.id)}
                          disabled={busyAction === `cancel-${offer.id}`}
                          className="text-xs text-negative hover:underline disabled:opacity-40"
                        >
                          {busyAction === `cancel-${offer.id}` ? "Cancelling…" : "Cancel & reclaim"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
