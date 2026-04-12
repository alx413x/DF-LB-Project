import { CircleDollarSign, Coins, TrendingUp } from "lucide-react";
import { useLendingContext } from "../../context/useLendingContext";
import { formatUSD, formatPercent, formatAmount } from "../../utils/formatters";

const TOKEN_ICONS = {
  USDC: CircleDollarSign,
  ETH: Coins,
};

export default function MarketOverview({ selectedAsset, onSelectAsset }) {
  const { assets } = useLendingContext();

  return (
    <div className="bg-gray-900/70 backdrop-blur-lg border border-white/10 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-white/10">
        <TrendingUp className="w-5 h-5 text-secondary" />
        <h2 className="text-lg font-semibold">Market Overview</h2>
      </div>

      {/* Header Row */}
      <div className="hidden md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] items-center px-6 py-3 text-xs text-text-secondary uppercase tracking-wider border-b border-white/5 gap-4">
        <div>Asset</div>
        <div className="text-right">Total Supply</div>
        <div className="text-right">Total Borrow</div>
        <div className="text-right">Supply APY</div>
        <div className="text-right">Borrow APY</div>
        <div className="text-right">Utilization</div>
      </div>

      {assets.map((asset) => {
        const Icon = TOKEN_ICONS[asset.symbol] || Coins;
        const isSelected = asset.symbol === selectedAsset;
        return (
          <button
            key={asset.symbol}
            onClick={() => onSelectAsset(asset.symbol)}
            className={`w-full flex flex-col md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] md:items-center px-6 py-4 transition-colors border-b border-white/5 last:border-b-0 gap-4 cursor-pointer text-left ${
              isSelected ? "bg-white/10" : "hover:bg-white/5"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 ${
                isSelected ? "bg-primary/20 border-primary/30" : "bg-gray-800 border-white/10"
              }`}>
                <Icon className={`w-5 h-5 ${isSelected ? "text-primary" : "text-text-secondary"}`} />
              </div>
              <div>
                <div className="font-medium">{asset.symbol}</div>
                <div className="text-xs text-text-secondary">{asset.name}</div>
              </div>
            </div>
            <div className="text-right font-mono text-sm">
              <div>{formatAmount(asset.totalSupply, asset.symbol)}</div>
              <div className="text-xs text-text-secondary">{formatUSD(asset.totalSupply * asset.price)}</div>
            </div>
            <div className="text-right font-mono text-sm">
              <div>{formatAmount(asset.totalBorrow, asset.symbol)}</div>
              <div className="text-xs text-text-secondary">{formatUSD(asset.totalBorrow * asset.price)}</div>
            </div>
            <div className="text-right font-mono text-sm text-primary">{formatPercent(asset.supplyAPY)}</div>
            <div className="text-right font-mono text-sm text-secondary">{formatPercent(asset.borrowAPY)}</div>
            <div className="text-right">
              <span className="font-mono text-sm">{formatPercent(asset.utilization)}</span>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mt-1">
                <div
                  className={`h-full rounded-full ${asset.utilization > 0.8 ? "bg-danger" : "bg-secondary"}`}
                  style={{ width: `${asset.utilization * 100}%` }}
                />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
