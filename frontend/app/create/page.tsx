"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@starknet-react/core";
import { useContracts } from "@/lib/hooks";
import { CONTRACTS } from "@/lib/contracts";

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
      <span className="block text-sm text-fg mb-1.5">{label}</span>
      <input
        {...props}
        className="w-full bg-bg-raised border border-border rounded px-3 py-2.5 text-sm text-fg focus:outline-none focus:border-accent"
      />
      {hint && <span className="block text-xs text-fg-faint mt-1.5">{hint}</span>}
    </label>
  );
}

export default function CreatePage() {
  const { account, status } = useAccount();
  const { swapCore, collateralToken } = useContracts();
  const router = useRouter();

  const [notional, setNotional] = useState("10000000");
  const [fixedRateBps, setFixedRateBps] = useState("80");
  const [durationEpochs, setDurationEpochs] = useState("6");
  const [collateral, setCollateral] = useState("5000000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offerId, setOfferId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    setBusy(true);
    setError(null);
    setOfferId(null);

    try {
      const approveCall = collateralToken.populate("approve", [
        CONTRACTS.swapCore.address,
        BigInt(collateral),
      ]);
      const postCall = swapCore.populate("post_offer", [
        BigInt(notional),
        BigInt(fixedRateBps),
        BigInt(durationEpochs),
        BigInt(collateral),
      ]);
      const { transaction_hash } = await account.execute([
        approveCall,
        postCall,
      ]);
      const receipt = await account.waitForTransaction(transaction_hash);
      setOfferId(transaction_hash);
      void receipt;
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
          collateral — mint it via{" "}
          <code className="text-fg-dim">mint</code> on the
          MockCollateralToken contract.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-16">
      <h1 className="text-2xl font-medium text-fg mb-2">Post a fixed-rate offer</h1>
      <p className="text-fg-dim text-sm mb-10">
        You take the fixed side. Your collateral gets locked in escrow
        immediately; every settled epoch tops your yield up (or down) to
        exactly the rate below.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Field
          label="Notional"
          hint="Sats-denominated BTC notional the rate is applied to"
          value={notional}
          onChange={(e) => setNotional(e.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric"
        />
        <Field
          label="Fixed rate (bps)"
          hint="STRK-units per 1,000,000 sats staked, per epoch"
          value={fixedRateBps}
          onChange={(e) => setFixedRateBps(e.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric"
        />
        <Field
          label="Duration (epochs)"
          value={durationEpochs}
          onChange={(e) => setDurationEpochs(e.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric"
        />
        <Field
          label="Your collateral"
          hint="Locked immediately via approve + transfer_from"
          value={collateral}
          onChange={(e) => setCollateral(e.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric"
        />

        {error && <p className="text-sm text-negative">{error}</p>}

        {offerId && (
          <div className="text-sm text-positive border border-positive/30 rounded p-3">
            Offer posted.{" "}
            <a
              className="underline hover:text-fg"
              href={`https://sepolia.voyager.online/tx/${offerId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View transaction
            </a>{" "}
            —{" "}
            <button
              type="button"
              onClick={() => router.push("/market")}
              className="underline hover:text-fg"
            >
              go to market
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-fg text-bg text-sm rounded px-4 py-3 disabled:opacity-40 hover:bg-accent transition-colors"
        >
          {busy ? "Confirming in wallet…" : "Approve & Post Offer"}
        </button>
      </form>
    </div>
  );
}
