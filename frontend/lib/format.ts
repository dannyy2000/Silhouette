export function shortenAddress(address: string, chars = 4) {
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

export function formatUnits(value: bigint | number) {
  return new Intl.NumberFormat("en-US").format(
    typeof value === "bigint" ? value : BigInt(Math.trunc(value)),
  );
}

export function formatBps(bps: bigint | number) {
  return `${bps.toString()} bps`;
}

export const OFFER_STATUS = ["Open", "Accepted", "Cancelled"] as const;
export const SWAP_STATUS = ["Active", "Completed", "Liquidated"] as const;
