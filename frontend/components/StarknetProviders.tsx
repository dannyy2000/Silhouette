"use client";

import React from "react";
import {
  StarknetConfig,
  publicProvider,
  useInjectedConnectors,
  argent,
  braavos,
} from "@starknet-react/core";
import { sepolia } from "@starknet-react/chains";

function InnerProviders({ children }: { children: React.ReactNode }) {
  const { connectors } = useInjectedConnectors({
    recommended: [argent(), braavos()],
    includeRecommended: "always",
    order: "random",
  });

  return (
    <StarknetConfig
      chains={[sepolia]}
      provider={publicProvider()}
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
