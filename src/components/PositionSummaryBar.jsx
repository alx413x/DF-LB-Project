import { useLendingContext } from "../context/useLendingContext";
import { formatUSD } from "../utils/formatters";

export default function PositionSummaryBar() {
  const { assets } = useLendingContext();

  const collateralBreakdown = assets
    .filter((a) => a.userSupplied > 0)
    .map((a) => ({
      symbol: a.symbol,
      valueUSD: a.userSupplied * a.price,
    }));

  const debtBreakdown = assets
    .filter((a) => a.userBorrowed > 0)
    .map((a) => ({
      symbol: a.symbol,
      valueUSD: a.userBorrowed * a.price,
    }));

  const totalCollateral = collateralBreakdown.reduce((s, c) => s + c.valueUSD, 0);
  const totalDebt = debtBreakdown.reduce((s, d) => s + d.valueUSD, 0);

  if (totalCollateral === 0 && totalDebt === 0) return null;

  const COLORS = { USDC: "bg-primary", ETH: "bg-secondary" };

  return (
    <div className="bg-gray-900/70 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Collateral composition */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-secondary">Collateral Composition</span>
            <span className="text-sm font-mono">{formatUSD(totalCollateral)}</span>
          </div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden flex">
            {collateralBreakdown.map((c) => (
              <div
                key={c.symbol}
                className={`h-full ${COLORS[c.symbol] || "bg-gray-500"} first:rounded-l-full last:rounded-r-full`}
                style={{ width: `${(c.valueUSD / totalCollateral) * 100}%` }}
                title={`${c.symbol}: ${formatUSD(c.valueUSD)}`}
              />
            ))}
          </div>
          <div className="flex gap-4 mt-2">
            {collateralBreakdown.map((c) => (
              <div key={c.symbol} className="flex items-center gap-1.5 text-xs text-text-secondary">
                <span className={`w-2 h-2 rounded-full ${COLORS[c.symbol] || "bg-gray-500"}`} />
                {c.symbol} ({((c.valueUSD / totalCollateral) * 100).toFixed(0)}%)
              </div>
            ))}
          </div>
        </div>

        {/* Debt composition */}
        {totalDebt > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-text-secondary">Debt Composition</span>
              <span className="text-sm font-mono">{formatUSD(totalDebt)}</span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden flex">
              {debtBreakdown.map((d) => (
                <div
                  key={d.symbol}
                  className={`h-full ${COLORS[d.symbol] || "bg-gray-500"} first:rounded-l-full last:rounded-r-full`}
                  style={{ width: `${(d.valueUSD / totalDebt) * 100}%` }}
                  title={`${d.symbol}: ${formatUSD(d.valueUSD)}`}
                />
              ))}
            </div>
            <div className="flex gap-4 mt-2">
              {debtBreakdown.map((d) => (
                <div key={d.symbol} className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className={`w-2 h-2 rounded-full ${COLORS[d.symbol] || "bg-gray-500"}`} />
                  {d.symbol} ({((d.valueUSD / totalDebt) * 100).toFixed(0)}%)
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
