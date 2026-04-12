import { useState } from "react";
import { Wallet, Activity, CircleDot, Loader2 } from "lucide-react";
import { useLendingContext } from "../context/useLendingContext";
import { formatUSD, truncateAddress } from "../utils/formatters";

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "markets", label: "Markets" },
  { id: "liquidations", label: "Liquidations" },
];

export default function Header({ activeTab, onTabChange }) {
  const {
    isConnected,
    walletAddress,
    connectWallet,
    disconnectWallet,
    protocolStats,
  } = useLendingContext();
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      await connectWallet();
    } catch (err) {
      console.error("Wallet connection failed:", err);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-gray-900/95 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between py-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            <span className="text-lg font-semibold tracking-tight">LendX</span>
          </div>

          {/* Protocol Stats - visible on desktop */}
          <div className="hidden lg:flex items-center gap-8 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-text-secondary">TVL</span>
              <span className="font-mono font-medium">
                {formatUSD(protocolStats.tvl, true)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-secondary">Market Size</span>
              <span className="font-mono font-medium">
                {formatUSD(protocolStats.totalMarketSize, true)}
              </span>
            </div>
          </div>

          {/* Wallet Button */}
          {isConnected ? (
            <button
              onClick={disconnectWallet}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800/80 border border-white/10 rounded-xl text-sm font-medium hover:bg-gray-700/80 transition-all duration-200 ease-in-out cursor-pointer"
            >
              <CircleDot className="w-3 h-3 text-primary" />
              <span className="font-mono">{truncateAddress(walletAddress)}</span>
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center gap-2 px-4 py-2 bg-primary/15 border border-primary/30 rounded-xl text-sm font-medium text-primary hover:bg-primary/25 transition-all duration-200 ease-in-out cursor-pointer disabled:opacity-60"
            >
              {connecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4" />
                  Connect Wallet
                </>
              )}
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <nav className="flex gap-1 border-t border-white/5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-all duration-200 ease-in-out cursor-pointer relative ${
                activeTab === tab.id
                  ? "text-primary"
                  : "text-text-secondary hover:text-white"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
