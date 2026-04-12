import { ShieldCheck, Landmark, TrendingDown, Percent } from "lucide-react";
import { useLendingContext } from "../context/useLendingContext";
import { formatUSD, formatPercent, getHFColor, getHFDisplay } from "../utils/formatters";

function HFGauge({ healthFactor }) {
  // Map HF to a 0-100 percentage for the gauge bar
  // HF < 1.0 = danger zone (0-33%), HF 1.0-1.5 = warning (33-66%), HF > 1.5 = safe (66-100%)
  let percent;
  if (healthFactor === Infinity) {
    percent = 100;
  } else if (healthFactor <= 0) {
    percent = 0;
  } else if (healthFactor < 1.0) {
    percent = (healthFactor / 1.0) * 33;
  } else if (healthFactor < 1.5) {
    percent = 33 + ((healthFactor - 1.0) / 0.5) * 33;
  } else {
    percent = Math.min(100, 66 + ((healthFactor - 1.5) / 1.5) * 34);
  }

  const getBarColor = () => {
    if (healthFactor === Infinity || healthFactor > 1.5) return "bg-primary";
    if (healthFactor > 1.1) return "bg-warning";
    return "bg-danger";
  };

  return (
    <div className="mt-3">
      <div className="flex justify-between text-[10px] text-text-secondary mb-1">
        <span>Liquidation</span>
        <span>Safe</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getBarColor()}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-text-secondary mt-1">
        <span>1.0</span>
        <span>1.5</span>
        <span>3.0+</span>
      </div>
    </div>
  );
}

export default function HeroStats() {
  const { healthFactor, totalCollateralUSD, totalDebtUSD, netAPY, borrowLimitUSD, borrowLimitUsed } =
    useLendingContext();

  const cards = [
    {
      label: "Health Factor",
      value: getHFDisplay(healthFactor),
      valueClass: `text-3xl font-bold font-mono ${getHFColor(healthFactor)}`,
      icon: ShieldCheck,
      iconColor: "text-primary",
      extra: <HFGauge healthFactor={healthFactor} />,
    },
    {
      label: "Total Collateral",
      value: formatUSD(totalCollateralUSD),
      valueClass: "text-2xl font-bold font-mono text-white",
      icon: Landmark,
      iconColor: "text-primary",
      extra: (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-text-secondary mb-1">
            <span>Borrow Limit Used</span>
            <span className="font-mono">{formatPercent(borrowLimitUsed)}</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                borrowLimitUsed > 0.8 ? "bg-danger" : borrowLimitUsed > 0.6 ? "bg-warning" : "bg-primary"
              }`}
              style={{ width: `${Math.min(100, borrowLimitUsed * 100)}%` }}
            />
          </div>
          <div className="text-xs text-text-secondary mt-1 font-mono">
            Limit: {formatUSD(borrowLimitUSD)}
          </div>
        </div>
      ),
    },
    {
      label: "Total Debt",
      value: formatUSD(totalDebtUSD),
      valueClass: "text-2xl font-bold font-mono text-white",
      icon: TrendingDown,
      iconColor: "text-danger",
    },
    {
      label: "Net APY",
      value: formatPercent(netAPY),
      valueClass: `text-2xl font-bold font-mono ${netAPY >= 0 ? "text-primary" : "text-danger"}`,
      icon: Percent,
      iconColor: "text-secondary",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-gray-900/70 backdrop-blur-lg border border-white/10 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-text-secondary">{card.label}</span>
            <card.icon className={`w-5 h-5 ${card.iconColor}`} />
          </div>
          <div className={card.valueClass}>{card.value}</div>
          {card.extra}
        </div>
      ))}
    </div>
  );
}
