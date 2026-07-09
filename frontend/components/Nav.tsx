"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";

const links = [
  { href: "/market", label: "Market" },
  { href: "/create", label: "Post Offer" },
  { href: "/dashboard", label: "Dashboard" },
];

function shorten(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function WalletControl() {
  const { address, status } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (status === "connected" && address) {
    return (
      <div className="hidden md:flex items-center gap-3">
        <div className="flex items-center gap-2 border border-border rounded px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-positive" />
          <span className="text-xs font-mono text-fg-dim">
            {shorten(address)}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className="text-xs text-fg-faint hover:text-fg transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="hidden md:block relative">
      <button
        onClick={() => setPickerOpen((v) => !v)}
        className="border border-border-strong text-fg text-sm px-4 py-2 rounded hover:border-accent hover:text-accent transition-colors"
      >
        Connect Wallet
      </button>
      {pickerOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-bg-raised border border-border rounded shadow-lg py-1 z-40">
          {connectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => {
                connect({ connector });
                setPickerOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-fg-dim hover:text-fg hover:bg-bg-raised-2 transition-colors"
            >
              {connector.name}
            </button>
          ))}
          {connectors.length === 0 && (
            <div className="px-3 py-2 text-xs text-fg-faint">
              No Starknet wallet detected
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-border sticky top-0 z-30 bg-bg/90 backdrop-blur">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="text-accent text-lg leading-none">◐</span>
          <span className="font-medium text-fg text-sm tracking-wide">
            Silhouette
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 rounded text-sm transition-colors ${
                pathname === href
                  ? "text-fg"
                  : "text-fg-faint hover:text-fg"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <WalletControl />
          <button
            className="md:hidden p-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <div className="w-5 space-y-1.5">
              <span
                className={`block h-px bg-fg transition-all ${menuOpen ? "rotate-45 translate-y-1.5" : ""}`}
              />
              <span
                className={`block h-px bg-fg transition-all ${menuOpen ? "opacity-0" : ""}`}
              />
              <span
                className={`block h-px bg-fg transition-all ${menuOpen ? "-rotate-45 -translate-y-1.5" : ""}`}
              />
            </div>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-border px-6 py-4 space-y-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className={`block px-3 py-2.5 rounded text-sm ${
                pathname === href ? "text-fg" : "text-fg-faint"
              }`}
            >
              {label}
            </Link>
          ))}
          <MobileWallet />
        </div>
      )}
    </header>
  );
}

function MobileWallet() {
  const { address, status } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (status === "connected" && address) {
    return (
      <div className="pt-3 mt-2 border-t border-border flex items-center justify-between px-3">
        <span className="text-xs font-mono text-fg-dim">
          {shorten(address)}
        </span>
        <button
          onClick={() => disconnect()}
          className="text-xs text-negative"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="pt-3 mt-2 border-t border-border px-3 space-y-2">
      {connectors.map((connector) => (
        <button
          key={connector.id}
          onClick={() => connect({ connector })}
          className="w-full text-left text-sm text-fg-dim py-2"
        >
          Connect {connector.name}
        </button>
      ))}
    </div>
  );
}
