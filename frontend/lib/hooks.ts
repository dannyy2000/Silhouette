"use client";

import { useMemo } from "react";
import { Contract, type Abi, type ProviderInterface, type AccountInterface } from "starknet";
import { useAccount, useProvider } from "@starknet-react/core";
import { CONTRACTS } from "./contracts";

export function useContracts() {
  const { provider } = useProvider();
  const { account } = useAccount();

  return useMemo(() => {
    const providerOrAccount: ProviderInterface | AccountInterface =
      account ?? provider;
    return {
      collateralToken: new Contract({
        abi: CONTRACTS.collateralToken.abi as unknown as Abi,
        address: CONTRACTS.collateralToken.address,
        providerOrAccount,
      }),
      rateOracle: new Contract({
        abi: CONTRACTS.rateOracle.abi as unknown as Abi,
        address: CONTRACTS.rateOracle.address,
        providerOrAccount,
      }),
      swapCore: new Contract({
        abi: CONTRACTS.swapCore.abi as unknown as Abi,
        address: CONTRACTS.swapCore.address,
        providerOrAccount,
      }),
    };
  }, [account, provider]);
}
