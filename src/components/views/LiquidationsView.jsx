import LiquidationAlert from "../liquidation/LiquidationAlert";
import LiquidatablePositions from "../liquidation/LiquidatablePositions";
import { Shield, AlertTriangle } from "lucide-react";

export default function LiquidationsView() {
  return (
    <>
      <LiquidationAlert />

      {/* Explanation section */}
      <div className="bg-gray-900/70 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-secondary" />
          How Liquidation Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-text-secondary">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-medium">
              <AlertTriangle className="w-4 h-4 text-warning" />
              When does it happen?
            </div>
            <p>
              When a borrower&apos;s Health Factor drops below 1.0, their position
              becomes eligible for liquidation.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-medium">
              <AlertTriangle className="w-4 h-4 text-secondary" />
              Close Factor
            </div>
            <p>
              Liquidators can repay up to 50% of the borrower&apos;s debt in a
              single transaction.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-medium">
              <AlertTriangle className="w-4 h-4 text-primary" />
              Liquidation Bonus
            </div>
            <p>
              Liquidators receive the borrower&apos;s collateral at a discount
              (5-10% bonus) as an incentive.
            </p>
          </div>
        </div>
      </div>

      <LiquidatablePositions />
    </>
  );
}
