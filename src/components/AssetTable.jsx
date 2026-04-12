import { useState } from "react";
import { CircleDollarSign, Coins } from "lucide-react";
import { useLendingContext } from "../context/useLendingContext";
import ActionModal from "./ActionModal";

function formatUSD(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatAmount(value, symbol) {
  if (symbol === "USDC") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
      value
    );
  }
  return value.toFixed(4);
}

const TOKEN_ICONS = {
  USDC: CircleDollarSign,
  ETH: Coins,
};

export default function AssetTable({ type }) {
  const { assets } = useLendingContext();
  const [modal, setModal] = useState({ open: false, action: "", asset: null });

  const isSupply = type === "supply";
  const title = isSupply ? "Assets to Supply" : "Assets to Borrow";

  const openModal = (action, asset) => {
    setModal({ open: true, action, asset });
  };

  const closeModal = () => {
    setModal({ open: false, action: "", asset: null });
  };

  return (
    <div className="bg-gray-900/70 backdrop-blur-lg border border-white/10 rounded-2xl overflow-hidden">
      {/* Title */}
      <div className="px-6 py-4 border-b border-white/10">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>

      {/* Header Row */}
      <div className="hidden md:grid md:grid-cols-[2fr_1fr_1fr_1fr_160px] items-center px-6 py-3 text-xs text-text-secondary uppercase tracking-wider border-b border-white/5 gap-4">
        <div>Asset</div>
        <div className="text-right">
          {isSupply ? "Supply APY" : "Borrow APY"}
        </div>
        <div className="text-right">
          {isSupply ? "Supplied" : "Borrowed"}
        </div>
        <div className="text-right">Wallet</div>
        <div className="text-right">Actions</div>
      </div>

      {/* Asset Rows */}
      {assets.map((asset) => {
        const Icon = TOKEN_ICONS[asset.symbol] || Coins;
        const apy = isSupply ? asset.supplyAPY : asset.borrowAPY;
        const position = isSupply ? asset.userSupplied : asset.userBorrowed;
        const positionUSD = position * asset.price;
        const primaryAction = isSupply ? "deposit" : "borrow";
        const secondaryAction = isSupply ? "withdraw" : "repay";

        return (
          <div
            key={asset.symbol}
            className="flex flex-col md:grid md:grid-cols-[2fr_1fr_1fr_1fr_160px] md:items-center px-6 py-4 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0 gap-4"
          >
            {/* Asset Info */}
            <div className="flex items-center gap-3 mb-3 md:mb-0">
              <div className="w-9 h-9 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-text-secondary" />
              </div>
              <div>
                <div className="font-medium">{asset.symbol}</div>
                <div className="text-xs text-text-secondary">{asset.name}</div>
              </div>
            </div>

            {/* APY */}
            <div className="text-left md:text-right mb-2 md:mb-0">
              <span className="md:hidden text-xs text-text-secondary mr-2">
                APY:
              </span>
              <span
                className={`font-mono text-sm ${isSupply ? "text-primary" : "text-secondary"}`}
              >
                {formatPercent(apy)}
              </span>
            </div>

            {/* Position */}
            <div className="text-left md:text-right mb-2 md:mb-0">
              <span className="md:hidden text-xs text-text-secondary mr-2">
                {isSupply ? "Supplied:" : "Borrowed:"}
              </span>
              <div className="font-mono text-sm">
                {formatAmount(position, asset.symbol)} {asset.symbol}
              </div>
              <div className="text-xs text-text-secondary font-mono">
                {formatUSD(positionUSD)}
              </div>
            </div>

            {/* Wallet Balance */}
            <div className="text-left md:text-right mb-3 md:mb-0 hidden md:block">
              <div className="font-mono text-sm">
                {formatAmount(asset.walletBalance, asset.symbol)}
              </div>
              <div className="text-xs text-text-secondary font-mono">
                {formatUSD(asset.walletBalance * asset.price)}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-start md:justify-end">
              <button
                onClick={() => openModal(primaryAction, asset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ease-in-out cursor-pointer ${
                  isSupply
                    ? "bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25"
                    : "bg-secondary/15 text-secondary border border-secondary/30 hover:bg-secondary/25"
                }`}
              >
                {isSupply ? "Deposit" : "Borrow"}
              </button>
              <button
                onClick={() => openModal(secondaryAction, asset)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800/80 border border-white/10 text-text-secondary hover:bg-gray-700/80 hover:text-white transition-all duration-200 ease-in-out cursor-pointer"
              >
                {isSupply ? "Withdraw" : "Repay"}
              </button>
            </div>
          </div>
        );
      })}

      {/* Action Modal */}
      {modal.open && (
        <ActionModal
          isOpen={modal.open}
          onClose={closeModal}
          actionType={modal.action}
          asset={modal.asset}
        />
      )}
    </div>
  );
}
