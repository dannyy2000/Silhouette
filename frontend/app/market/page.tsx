"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "@starknet-react/core";
import { CairoOption } from "starknet";
import { useContracts } from "@/lib/hooks";
import { CONTRACTS } from "@/lib/contracts";
import { formatUnits, OFFER_STATUS, shortenAddress } from "@/lib/format";

interface OfferRow {
  id: number;
  fixedParty: string;
  notional: bigint;
  fixedRateBps: bigint;
  durationEpochs: bigint;
  collateral: bigint;
  status: number;
}

export default function MarketPage() {
  const { swapCore, collateralToken } = useContracts();
  const { account, address } = useAccount();
  const [offers, setOffers] = useState<OfferRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [amountInput, setAmountInput] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
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

  async function handleAccept(offer: OfferRow) {
    if (!account) return;
    const amountStr = amountInput[offer.id];
    if (!amountStr) return;
    const amount = BigInt(amountStr);

    try {
      setBusyId(offer.id);
      setError(null);
      const approveCall = collateralToken.populate("approve", [
        CONTRACTS.swapCore.address,
        amount,
      ]);
      const acceptCall = swapCore.populate("accept_offer", [
        offer.id,
        amount,
      ]);
      const { transaction_hash } = await account.execute([
        approveCall,
        acceptCall,
      ]);
      setTxHash(transaction_hash);
      await account.waitForTransaction(transaction_hash);
      setAcceptingId(null);
      await load();
    } catch (e) {
      console.error(e);
      setError("Transaction failed. See console for details.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="flex items-baseline justify-between mb-10">
        <h1 className="text-2xl font-medium text-fg">Market</h1>
        <span className="text-xs text-fg-faint">
          {offers ? `${offers.length} offer${offers.length === 1 ? "" : "s"}` : "loading…"}
        </span>
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
        <p className="text-fg-faint text-sm">Reading offers from the chain…</p>
      )}

      {offers?.length === 0 && (
        <p className="text-fg-faint text-sm">
          No offers posted yet.{" "}
          <a href="/create" className="text-accent hover:underline">
            Post the first one
          </a>
          .
        </p>
      )}

      <div className="space-y-3">
        {offers?.map((offer) => (
          <div
            key={offer.id}
            className="border border-border rounded p-5 hover:border-border-strong transition-colors"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-2 text-sm">
                <div>
                  <div className="text-fg-faint text-xs mb-1">Fixed rate</div>
                  <div className="text-fg">{offer.fixedRateBps.toString()} bps</div>
                </div>
                <div>
                  <div className="text-fg-faint text-xs mb-1">Notional</div>
                  <div className="text-fg">{formatUnits(offer.notional)}</div>
                </div>
                <div>
                  <div className="text-fg-faint text-xs mb-1">Duration</div>
                  <div className="text-fg">{offer.durationEpochs.toString()} epochs</div>
                </div>
                <div>
                  <div className="text-fg-faint text-xs mb-1">Fixed party</div>
                  <div className="text-fg font-mono text-xs">
                    {shortenAddress(offer.fixedParty)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-1 rounded border ${
                    offer.status === 0
                      ? "border-positive/40 text-positive"
                      : "border-border text-fg-faint"
                  }`}
                >
                  {OFFER_STATUS[offer.status]}
                </span>
                {offer.status === 0 &&
                  address &&
                  address.toLowerCase() !== offer.fixedParty.toLowerCase() && (
                    <button
                      onClick={() =>
                        setAcceptingId(acceptingId === offer.id ? null : offer.id)
                      }
                      className="text-xs border border-border-strong rounded px-3 py-1.5 hover:border-accent hover:text-accent transition-colors"
                    >
                      Accept
                    </button>
                  )}
              </div>
            </div>

            {acceptingId === offer.id && (
              <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs text-fg-faint mb-1">
                    Your collateral (must clear 110% maintenance margin)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 7500000"
                    value={amountInput[offer.id] ?? ""}
                    onChange={(e) =>
                      setAmountInput((prev) => ({
                        ...prev,
                        [offer.id]: e.target.value.replace(/[^0-9]/g, ""),
                      }))
                    }
                    className="bg-bg-raised border border-border rounded px-3 py-2 text-sm text-fg w-56 focus:outline-none focus:border-accent"
                  />
                </div>
                <button
                  onClick={() => handleAccept(offer)}
                  disabled={busyId === offer.id || !amountInput[offer.id]}
                  className="text-sm bg-fg text-bg rounded px-4 py-2 disabled:opacity-40 hover:bg-accent transition-colors"
                >
                  {busyId === offer.id ? "Confirming…" : "Approve & Accept"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
