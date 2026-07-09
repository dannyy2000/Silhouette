"use client";

import dynamic from "next/dynamic";

const StarknetProviders = dynamic(
  () => import("@/components/StarknetProviders"),
  { ssr: false },
);

const Nav = dynamic(() => import("@/components/Nav"), { ssr: false });

export default function ClientShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StarknetProviders>
      <Nav />
      {children}
    </StarknetProviders>
  );
}
