import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle, ShieldCheck } from "lucide-react";
import { useLendingContext } from "../context/useLendingContext";
import { getHFColor, getHFDisplay, formatPercent } from "../utils/formatters";

const ACTION_CONFIG = {
  deposit: { label: "Deposit", color: "bg-primary hover:bg-primary/80", balanceLabel: "Wallet Balance" },
  withdraw: { label: "Withdraw", color: "bg-primary hover:bg-primary/80", balanceLabel: "Supplied" },
  borrow: { label: "Borrow", color: "bg-secondary hover:bg-secondary/80", balanceLabel: "Available to Borrow" },
  repay: { label: "Repay", color: "bg-secondary hover:bg-secondary/80", balanceLabel: "Debt" },
};

export default function ActionModal({ isOpen, onClose, actionType, asset }) {
  const {
    healthFactor,
    simulateHealthFactor,
    calculateMaxBorrow,
    borrowLimitUSD,
    totalDebtUSD,
    deposit,
    withdraw,
    borrow,
    repay,
    approve,
    allowances,
    isConnected,
  } = useLendingContext();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);

  const config = ACTION_CONFIG[actionType];

  const maxAmount = useMemo(() => {
    switch (actionType) {
      case "deposit":
        return asset.walletBalance;
      case "withdraw":
        return asset.userSupplied;
      case "borrow":
        return calculateMaxBorrow(asset.symbol);
      case "repay":
        return Math.min(asset.userBorrowed, asset.walletBalance);
      default:
        return 0;
    }
  }, [actionType, asset, calculateMaxBorrow]);

  const newHF = useMemo(() => {
    if (!amount || parseFloat(amount) <= 0) return healthFactor;
    return simulateHealthFactor(actionType, asset.symbol, amount);
  }, [amount, actionType, asset.symbol, simulateHealthFactor, healthFactor]);

  const isRisky = newHF !== Infinity && newHF < 1.1;
  const exceedsMax = parseFloat(amount) > maxAmount;
  const isValid = amount && parseFloat(amount) > 0 && !exceedsMax && isConnected;

  // Check if approval is needed (deposit and repay transfer tokens from user)
  const needsApproval = useMemo(() => {
    if (actionType !== "deposit" && actionType !== "repay") return false;
    const num = parseFloat(amount);
    if (!num || num <= 0) return false;
    const currentAllowance = allowances[asset.symbol] || 0;
    return currentAllowance < num;
  }, [actionType, amount, allowances, asset.symbol]);

  // LTV usage after this action
  const ltvAfterAction = useMemo(() => {
    if (actionType !== "borrow" || !amount) return null;
    const newDebt = totalDebtUSD + parseFloat(amount) * asset.price;
    return borrowLimitUSD > 0 ? newDebt / borrowLimitUSD : 0;
  }, [actionType, amount, totalDebtUSD, borrowLimitUSD, asset.price]);

  const handleApprove = async () => {
    setApproving(true);
    try {
      await approve(asset.symbol);
    } catch {
      // Error toast handled in useLending
    } finally {
      setApproving(false);
    }
  };

  const handleConfirm = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0 || exceedsMax) return;

    setLoading(true);
    try {
      switch (actionType) {
        case "deposit":
          await deposit(asset.symbol, num);
          break;
        case "withdraw":
          await withdraw(asset.symbol, num);
          break;
        case "borrow":
          await borrow(asset.symbol, num);
          break;
        case "repay":
          await repay(asset.symbol, num);
          break;
      }
      onClose();
    } catch {
      // Error toast handled in useLending
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900/95 backdrop-blur-lg border border-white/10 rounded-2xl p-6 w-full max-w-md transition-all duration-200 ease-in-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">
            {config.label} {asset.symbol}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Not Connected Warning */}
        {!isConnected && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 mb-4 text-sm text-warning flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Connect your wallet to perform actions.
          </div>
        )}

        {/* Amount Input */}
        <div className="mb-4">
          <label className="text-sm text-text-secondary mb-2 block">
            Amount
          </label>
          <div className={`flex items-center bg-gray-800/80 border rounded-xl overflow-hidden ${
            exceedsMax ? "border-danger/50" : "border-white/10"
          }`}>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-transparent px-4 py-3 text-white font-mono text-lg outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              disabled={loading || approving}
            />
            <button
              onClick={() => setAmount(String(maxAmount))}
              className="px-3 py-1 mr-3 text-xs font-semibold text-primary bg-primary/15 rounded-lg hover:bg-primary/25 transition-colors cursor-pointer"
              disabled={loading || approving}
            >
              MAX
            </button>
          </div>
          {exceedsMax && (
            <p className="text-xs text-danger mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Exceeds maximum available amount
            </p>
          )}
        </div>

        {/* Balance Info */}
        <div className="flex items-center justify-between text-sm mb-4 px-1">
          <span className="text-text-secondary">{config.balanceLabel}</span>
          <span className="font-mono">
            {maxAmount.toFixed(asset.symbol === "USDC" ? 2 : 4)} {asset.symbol}
          </span>
        </div>

        {/* LTV Bar for Borrow */}
        {actionType === "borrow" && ltvAfterAction !== null && (
          <div className="bg-gray-800/60 border border-white/10 rounded-xl p-4 mb-4">
            <div className="flex justify-between text-xs text-text-secondary mb-1">
              <span>Borrow Limit Usage</span>
              <span className="font-mono">{formatPercent(ltvAfterAction)}</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  ltvAfterAction > 0.9 ? "bg-danger" : ltvAfterAction > 0.7 ? "bg-warning" : "bg-primary"
                }`}
                style={{ width: `${Math.min(100, ltvAfterAction * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Health Factor Simulator */}
        <div className="bg-gray-800/60 border border-white/10 rounded-xl p-4 mb-6">
          <div className="text-sm text-text-secondary mb-2">Health Factor</div>
          <div className="flex items-center gap-3">
            <span className={`text-xl font-bold font-mono ${getHFColor(healthFactor)}`}>
              {getHFDisplay(healthFactor)}
            </span>
            <span className="text-text-secondary">&rarr;</span>
            <span className={`text-xl font-bold font-mono ${getHFColor(newHF)}`}>
              {getHFDisplay(newHF)}
            </span>
          </div>
          {isRisky && (
            <p className="text-xs text-danger mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Warning: This action will put your position at liquidation risk.
            </p>
          )}
        </div>

        {/* Approve Button (for deposit/repay when approval needed) */}
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
                  Approve {asset.symbol}
                </span>
              )}
            </button>
            <p className="text-xs text-text-secondary text-center">
              You need to approve LendingPool to spend your {asset.symbol} first.
            </p>
          </div>
        ) : (
          /* Confirm Button */
          <button
            onClick={handleConfirm}
            disabled={!isValid || loading}
            className={`w-full py-3 rounded-xl text-white font-semibold transition-all duration-200 ease-in-out cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${config.color}`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              `${config.label} ${asset.symbol}`
            )}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
