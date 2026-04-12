import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle, Gift, ShieldCheck } from "lucide-react";
import { useLendingContext } from "../../context/useLendingContext";
import { formatAmount, formatUSD, truncateAddress } from "../../utils/formatters";

const CLOSE_FACTOR = 0.5;

export default function LiquidationModal({ position, onClose }) {
  const { liquidate, approve, allowances, assets } = useLendingContext();
  const [selectedDebt, setSelectedDebt] = useState(position.debt[0]?.symbol || "");
  const [selectedCollateral, setSelectedCollateral] = useState(position.collateral[0]?.symbol || "");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);

  const assetPrices = {};
  for (const a of assets) assetPrices[a.symbol] = a.price;

  // Get liquidation bonus from asset config
  const debtAssetConfig = assets.find((a) => a.symbol === selectedDebt);
  const bonus = debtAssetConfig ? debtAssetConfig.liquidationBonusBps / 10000 : 0.05;

  const maxRepay = useMemo(() => {
    const debtEntry = position.debt.find((d) => d.symbol === selectedDebt);
    if (!debtEntry) return 0;
    return debtEntry.amount * CLOSE_FACTOR;
  }, [position, selectedDebt]);

  const repayAmount = parseFloat(amount) || 0;
  const repayValueUSD = repayAmount * (assetPrices[selectedDebt] || 0);
  const collateralReceivedUSD = repayValueUSD * (1 + bonus);
  const profitUSD = collateralReceivedUSD - repayValueUSD;

  const isValid = repayAmount > 0 && repayAmount <= maxRepay;

  // Check if approval is needed for debt token
  const needsApproval = useMemo(() => {
    if (!repayAmount || repayAmount <= 0) return false;
    const currentAllowance = allowances[selectedDebt] || 0;
    return currentAllowance < repayAmount;
  }, [repayAmount, allowances, selectedDebt]);

  const handleApprove = async () => {
    setApproving(true);
    try {
      await approve(selectedDebt);
    } catch {
      // Error toast handled in useLending
    } finally {
      setApproving(false);
    }
  };

  const handleConfirm = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      await liquidate(position.address, selectedDebt, repayAmount, selectedCollateral);
      onClose();
    } catch {
      // Error toast handled in useLending
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900/95 backdrop-blur-lg border border-white/10 rounded-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-danger">Liquidate Position</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Position Info */}
        <div className="bg-gray-800/60 border border-white/10 rounded-xl p-4 mb-4">
          <div className="text-xs text-text-secondary mb-1">Borrower</div>
          <div className="font-mono text-sm">{truncateAddress(position.address)}</div>
        </div>

        {/* Select Debt to Repay */}
        <div className="mb-4">
          <label className="text-sm text-text-secondary mb-2 block">Debt to Repay</label>
          <div className="flex gap-2">
            {position.debt.map((d) => (
              <button
                key={d.symbol}
                onClick={() => {
                  setSelectedDebt(d.symbol);
                  setAmount("");
                }}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  selectedDebt === d.symbol
                    ? "bg-danger/15 text-danger border border-danger/30"
                    : "bg-gray-800/80 text-text-secondary border border-white/10 hover:border-white/20"
                }`}
              >
                {d.symbol}
                <div className="text-xs font-mono mt-0.5">{formatAmount(d.amount, d.symbol)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Select Collateral to Seize */}
        <div className="mb-4">
          <label className="text-sm text-text-secondary mb-2 block">Collateral to Seize</label>
          <div className="flex gap-2">
            {position.collateral.map((c) => (
              <button
                key={c.symbol}
                onClick={() => setSelectedCollateral(c.symbol)}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  selectedCollateral === c.symbol
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-gray-800/80 text-text-secondary border border-white/10 hover:border-white/20"
                }`}
              >
                {c.symbol}
                <div className="text-xs font-mono mt-0.5">{formatAmount(c.amount, c.symbol)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Amount Input */}
        <div className="mb-4">
          <label className="text-sm text-text-secondary mb-2 block">Amount</label>
          <div className="flex items-center bg-gray-800/80 border border-white/10 rounded-xl overflow-hidden">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-transparent px-4 py-3 text-white font-mono text-lg outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              disabled={loading || approving}
            />
            <button
              onClick={() => setAmount(String(maxRepay))}
              className="px-3 py-1 mr-3 text-xs font-semibold text-danger bg-danger/15 rounded-lg hover:bg-danger/25 transition-colors cursor-pointer"
            >
              MAX
            </button>
          </div>
          <div className="flex justify-between text-xs text-text-secondary mt-1 px-1">
            <span>Max repayable (50%)</span>
            <span className="font-mono">{formatAmount(maxRepay, selectedDebt)} {selectedDebt}</span>
          </div>
        </div>

        {/* Liquidation Summary */}
        <div className="bg-gray-800/60 border border-white/10 rounded-xl p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Repay Value</span>
            <span className="font-mono">{formatUSD(repayValueUSD)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Liquidation Bonus</span>
            <span className="font-mono text-primary">{(bonus * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Collateral Received</span>
            <span className="font-mono">{formatUSD(collateralReceivedUSD)}</span>
          </div>
          <div className="border-t border-white/10 pt-2 flex justify-between text-sm">
            <span className="text-text-secondary flex items-center gap-1">
              <Gift className="w-3.5 h-3.5 text-primary" />
              Estimated Profit
            </span>
            <span className="font-mono text-primary font-semibold">{formatUSD(profitUSD)}</span>
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 mb-4 text-xs text-text-secondary">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <span>
            Liquidation will repay the borrower&apos;s debt and transfer their collateral to you at a discount.
            This action cannot be undone.
          </span>
        </div>

        {/* Approve / Confirm */}
        {needsApproval ? (
          <div>
            <button
              onClick={handleApprove}
              disabled={approving || !isValid}
              className="w-full py-3 rounded-xl text-white font-semibold transition-all duration-200 ease-in-out cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-yellow-600 hover:bg-yellow-600/80 mb-2"
            >
              {approving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Approving...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Approve {selectedDebt}
                </span>
              )}
            </button>
            <p className="text-xs text-text-secondary text-center">
              Approve LendingPool to spend your {selectedDebt} for liquidation.
            </p>
          </div>
        ) : (
          <button
            onClick={handleConfirm}
            disabled={!isValid || loading}
            className="w-full py-3 rounded-xl text-white font-semibold bg-danger hover:bg-danger/80 transition-all duration-200 ease-in-out cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              "Confirm Liquidation"
            )}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
