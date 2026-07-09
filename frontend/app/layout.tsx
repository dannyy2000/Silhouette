import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientShell from "@/components/ClientShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Silhouette — Private BTC-Staking Rate Swaps on Starknet",
  description:
    "Lock in a fixed yield on Starknet's BTC-staking rate, or take the floating side, through an on-chain interest rate swap with STRK20 privacy.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-bg text-fg antialiased">
        <ClientShell>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border">
            <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-fg-faint">
                <span className="text-accent">◐</span>
                <span>Silhouette — private rate swaps on Starknet</span>
              </div>
              <div className="flex gap-6 text-xs text-fg-faint">
                <a
                  href="https://github.com/dannyy2000/Silhouette"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-fg transition-colors"
                >
                  GitHub
                </a>
                <a
                  href="https://sepolia.voyager.online/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-fg transition-colors"
                >
                  Explorer
                </a>
                <span>Sepolia Testnet</span>
              </div>
            </div>
          </footer>
        </ClientShell>
      </body>
    </html>
  );
}
