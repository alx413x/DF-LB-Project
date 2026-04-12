import { DollarSign, Percent, BarChart3, Shield } from "lucide-react";
import { formatUSD, formatPercent, formatAmount } from "../../utils/formatters";

export default function MarketStatsPanel({ asset }) {
  if (!asset) return null;

  const availableLiquidity = asset.totalSupply - asset.totalBorrow;

  const stats = [
    {
      label: "Total Supply",
      value: formatAmount(asset.totalSupply, asset.symbol) + " " + asset.symbol,
      subValue: formatUSD(asset.totalSupply * asset.price),
      icon: DollarSign,
      iconColor: "text-primary",
    },
    {
      label: "Total Borrow",
      value: formatAmount(asset.totalBorrow, asset.symbol) + " " + asset.symbol,
      subValue: formatUSD(asset.totalBorrow * asset.price),
      icon: BarChart3,
      iconColor: "text-secondary",
    },
    {
      label: "Available Liquidity",
      value: formatAmount(availableLiquidity, asset.symbol) + " " + asset.symbol,
      subValue: formatUSD(availableLiquidity * asset.price),
      icon: DollarSign,
      iconColor: "text-primary",
    },
    {
      label: "Supply APY",
      value: formatPercent(asset.supplyAPY),
      icon: Percent,
      iconColor: "text-primary",
    },
    {
      label: "Borrow APY",
      value: formatPercent(asset.borrowAPY),
      icon: Percent,
      iconColor: "text-secondary",
    },
    {
      label: "Utilization Rate",
      value: formatPercent(asset.utilization),
      icon: BarChart3,
      iconColor: asset.utilization > 0.8 ? "text-danger" : "text-secondary",
    },
    {
      label: "LTV",
      value: formatPercent(asset.ltv),
      icon: Shield,
      iconColor: "text-primary",
    },
    {
      label: "Liquidation Threshold",
      value: formatPercent(asset.liquidationThreshold),
      icon: Shield,
      iconColor: "text-warning",
    },
  ];

  return (
    <div className="bg-gray-900/70 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-base font-semibold">{asset.symbol} Market Details</h3>
        <span className="text-xs text-text-secondary">@ {formatUSD(asset.price)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-gray-800/60 border border-white/5 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <stat.icon className={`w-3.5 h-3.5 ${stat.iconColor}`} />
              <span className="text-xs text-text-secondary">{stat.label}</span>
            </div>
            <div className="font-mono text-sm font-medium">{stat.value}</div>
            {stat.subValue && (
              <div className="text-xs text-text-secondary font-mono">{stat.subValue}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
