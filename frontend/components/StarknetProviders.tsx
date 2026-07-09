"use client";

import React from "react";
import {
  StarknetConfig,
  jsonRpcProvider,
  useInjectedConnectors,
  argent,
  braavos,
} from "@starknet-react/core";
import { sepolia } from "@starknet-react/chains";

// publicProvider()'s default endpoint is Blast API's public Sepolia RPC,
// which Blast shut down ("Blast API is no longer available" — confirmed
// by curling it directly) — every read failed in-browser with "Failed to
// fetch". Starknet Foundry's own `sncast --network sepolia` flag resolves
// to this Alchemy demo endpoint, which is meant for shared/public use
// (not a personal API key) and does send proper CORS headers for browser
// fetches — confirmed with a manual preflight check.
const provider = jsonRpcProvider({
  rpc: () => ({
    nodeUrl:
      "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/uYLxCteYbHTFJpKSoKdVm",
  }),
});

function InnerProviders({ children }: { children: React.ReactNode }) {
  const { connectors } = useInjectedConnectors({
    recommended: [argent(), braavos()],
    includeRecommended: "always",
    order: "random",
  });

  return (
    <StarknetConfig
      chains={[sepolia]}
      provider={provider}
      connectors={connectors}
      autoConnect
    >
      {children}
    </StarknetConfig>
  );
}

export default function StarknetProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return <InnerProviders>{children}</InnerProviders>;
}
