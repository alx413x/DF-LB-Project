import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";
import {
  BASE_RATE,
  SLOPE_1,
  SLOPE_2,
  OPTIMAL_UTILIZATION,
  calculateBorrowAPY,
  calculateSupplyAPY,
} from "../../data/mockData";

export default function InterestRateCurve({ asset }) {
  const data = useMemo(() => {
    const points = [];
    for (let u = 0; u <= 100; u += 1) {
      const util = u / 100;
      points.push({
        utilization: u,
        borrowAPY: parseFloat((calculateBorrowAPY(util) * 100).toFixed(2)),
        supplyAPY: parseFloat((calculateSupplyAPY(util) * 100).toFixed(2)),
      });
    }
    return points;
  }, []);

  const currentUtil = asset ? (asset.utilization * 100).toFixed(1) : 0;

  return (
    <div className="bg-gray-900/70 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-secondary" />
          <h3 className="text-base font-semibold">Interest Rate Model</h3>
        </div>
        <span className="text-xs text-text-secondary">Kinked Rate Model</span>
      </div>

      {/* Model parameters */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs text-text-secondary">
        <span>Base: {(BASE_RATE * 100).toFixed(0)}%</span>
        <span>Slope1: {(SLOPE_1 * 100).toFixed(0)}%</span>
        <span>Slope2: {(SLOPE_2 * 100).toFixed(0)}%</span>
        <span>Optimal: {(OPTIMAL_UTILIZATION * 100).toFixed(0)}%</span>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="utilization"
            tick={{ fill: "#88909e", fontSize: 11 }}
            tickFormatter={(v) => `${v}%`}
            interval={19}
          />
          <YAxis
            tick={{ fill: "#88909e", fontSize: 11 }}
            tickFormatter={(v) => `${v}%`}
            width={45}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(11,15,25,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={(val, name) => [`${val}%`, name === "borrowAPY" ? "Borrow APY" : "Supply APY"]}
            labelFormatter={(v) => `Utilization: ${v}%`}
          />
          <ReferenceLine
            x={OPTIMAL_UTILIZATION * 100}
            stroke="rgba(255,255,255,0.2)"
            strokeDasharray="5 5"
            label={{ value: "Optimal", fill: "#88909e", fontSize: 10, position: "top" }}
          />
          {asset && (
            <ReferenceLine
              x={parseFloat(currentUtil)}
              stroke="#f79009"
              strokeDasharray="3 3"
              label={{ value: `Current: ${currentUtil}%`, fill: "#f79009", fontSize: 10, position: "insideTopRight" }}
            />
          )}
          <Line type="monotone" dataKey="borrowAPY" stroke="#2e90fa" strokeWidth={2} dot={false} name="borrowAPY" />
          <Line type="monotone" dataKey="supplyAPY" stroke="#00d395" strokeWidth={2} dot={false} name="supplyAPY" />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-3 justify-center text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-secondary rounded-full" />
          Borrow APY
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-primary rounded-full" />
          Supply APY
        </div>
      </div>
    </div>
  );
}
