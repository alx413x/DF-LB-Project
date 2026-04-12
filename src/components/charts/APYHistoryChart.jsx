import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { HISTORICAL_DATA } from "../../data/mockHistoricalData";

export default function APYHistoryChart({ selectedAsset }) {
  const data = HISTORICAL_DATA[selectedAsset] || HISTORICAL_DATA.USDC;

  return (
    <div className="bg-gray-900/70 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold">APY History (30d)</h3>
        <span className="text-xs text-text-secondary font-mono">{selectedAsset}</span>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="supplyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00d395" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00d395" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="borrowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2e90fa" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#2e90fa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#88909e", fontSize: 11 }}
            interval={6}
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
            formatter={(val, name) => [
              `${val}%`,
              name === "supplyAPY" ? "Supply APY" : "Borrow APY",
            ]}
          />
          <Area
            type="monotone"
            dataKey="supplyAPY"
            stroke="#00d395"
            strokeWidth={2}
            fill="url(#supplyGrad)"
            name="supplyAPY"
          />
          <Area
            type="monotone"
            dataKey="borrowAPY"
            stroke="#2e90fa"
            strokeWidth={2}
            fill="url(#borrowGrad)"
            name="borrowAPY"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-6 mt-3 justify-center text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-primary rounded-full" />
          Supply APY
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-secondary rounded-full" />
          Borrow APY
        </div>
      </div>
    </div>
  );
}
