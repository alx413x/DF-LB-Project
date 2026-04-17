import { useState } from "react";
import { Skull, CircleDollarSign, Coins, RefreshCw } from "lucide-react";
import { useLendingContext } from "../../context/useLendingContext";
import { formatUSD, formatAmount, getHFColor, getHFDisplay, truncateAddress } from "../../utils/formatters";
import LiquidationModal from "./LiquidationModal";

const TOKEN_ICONS = {
  USDC: CircleDollarSign,
  ETH: Coins,
};

export default function LiquidatablePositions() {
  const { liquidatablePositions, assets, refreshData, walletAddress } = useLendingContext();
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const assetPrices = {};
  for (const a of assets) assetPrices[a.symbol] = a.price;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  };

  // Filter out user's own position (cannot self-liquidate)
  // Already sorted by HF ascending from contractService
  const sorted = (liquidatablePositions || []).filter(
    (p) => p.address.toLowerCase() !== walletAddress.toLowerCase()
  );

  return (
    <div className="bg-gray-900/70 backdrop-blur-lg border border-white/10 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-white/10">
        <Skull className="w-5 h-5 text-danger" />
        <h2 className="text-lg font-semibold">Liquidatable Positions</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="ml-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
          title="Refresh positions"
        >
          <RefreshCw className={`w-4 h-4 text-text-secondary ${refreshing ? "animate-spin" : ""}`} />
        </button>
        <span className="ml-auto text-xs text-text-secondary">
          {sorted.filter((p) => p.healthFactor < 1.0).length} at risk
        </span>
      </div>

      {/* Header */}
      <div className="hidden md:grid md:grid-cols-[1.5fr_2fr_2fr_1fr_1fr] items-center px-6 py-3 text-xs text-text-secondary uppercase tracking-wider border-b border-white/5 gap-4">
        <div>Address</div>
        <div>Collateral</div>
        <div>Debt</div>
        <div className="text-right">Health Factor</div>
        <div className="text-right">Action</div>
      </div>

      {sorted.length === 0 ? (
        <div className="px-6 py-12 text-center text-text-secondary text-sm">
          No positions available for liquidation.
        </div>
      ) : (
        sorted.map((position) => {
          const isLiquidatable = position.healthFactor < 1.0;

          return (
            <div
              key={position.address}
              className={`flex flex-col md:grid md:grid-cols-[1.5fr_2fr_2fr_1fr_1fr] md:items-center px-6 py-4 border-b border-white/5 last:border-b-0 gap-4 ${
                isLiquidatable ? "bg-danger/5" : "hover:bg-white/5"
              } transition-colors`}
            >
              {/* Address */}
              <div className="font-mono text-sm">{truncateAddress(position.address)}</div>

              {/* Collateral */}
              <div className="space-y-1">
                {position.collateral.map((c) => {
                  const Icon = TOKEN_ICONS[c.symbol] || Coins;
                  return (
                    <div key={c.symbol} className="flex items-center gap-2 text-sm">
                      <Icon className="w-4 h-4 text-text-secondary shrink-0" />
                      <span className="font-mono">{formatAmount(c.amount, c.symbol)}</span>
                      <span className="text-text-secondary">{c.symbol}</span>
                      <span className="text-xs text-text-secondary">({formatUSD(c.amount * (assetPrices[c.symbol] || 0))})</span>
                    </div>
                  );
                })}
              </div>

              {/* Debt */}
              <div className="space-y-1">
                {position.debt.map((d) => {
                  const Icon = TOKEN_ICONS[d.symbol] || Coins;
                  return (
                    <div key={d.symbol} className="flex items-center gap-2 text-sm">
                      <Icon className="w-4 h-4 text-text-secondary shrink-0" />
                      <span className="font-mono">{formatAmount(d.amount, d.symbol)}</span>
                      <span className="text-text-secondary">{d.symbol}</span>
                      <span className="text-xs text-text-secondary">({formatUSD(d.amount * (assetPrices[d.symbol] || 0))})</span>
                    </div>
                  );
                })}
              </div>

              {/* Health Factor */}
              <div className={`text-right font-mono font-bold ${getHFColor(position.healthFactor)}`}>
                {getHFDisplay(position.healthFactor)}
              </div>

              {/* Action */}
              <div className="text-right">
                <button
                  onClick={() => setSelectedPosition(position)}
                  disabled={!isLiquidatable}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                    isLiquidatable
                      ? "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25"
                      : "bg-gray-800/50 text-text-secondary border border-white/5 cursor-not-allowed opacity-50"
                  }`}
                >
                  Liquidate
                </button>
              </div>
            </div>
          );
        })
      )}

      {selectedPosition && (
        <LiquidationModal
          position={selectedPosition}
          onClose={() => setSelectedPosition(null)}
        />
      )}
    </div>
  );
}
