import { AlertTriangle } from "lucide-react";
import { useLendingContext } from "../../context/useLendingContext";

export default function LiquidationAlert() {
  const { healthFactor } = useLendingContext();

  if (healthFactor === Infinity || healthFactor > 1.5) return null;

  const isUrgent = healthFactor < 1.1;

  return (
    <div
      className={`border rounded-2xl p-4 flex items-start gap-3 ${
        isUrgent
          ? "bg-danger/10 border-danger/30"
          : "bg-warning/10 border-warning/30"
      }`}
    >
      <AlertTriangle
        className={`w-5 h-5 shrink-0 mt-0.5 ${isUrgent ? "text-danger" : "text-warning"}`}
      />
      <div>
        <div className={`text-sm font-semibold ${isUrgent ? "text-danger" : "text-warning"}`}>
          {isUrgent ? "Liquidation Risk!" : "Low Health Factor Warning"}
        </div>
        <p className="text-xs text-text-secondary mt-1">
          {isUrgent
            ? "Your Health Factor is below 1.1. You are at immediate risk of liquidation. Consider repaying debt or adding collateral."
            : "Your Health Factor is below 1.5. Monitor your position closely and consider adding collateral to reduce liquidation risk."}
        </p>
      </div>
    </div>
  );
}
