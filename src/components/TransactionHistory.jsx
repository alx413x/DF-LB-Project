import { Clock, ArrowDownLeft, ArrowUpRight, Repeat, Hammer } from "lucide-react";
import { useLendingContext } from "../context/useLendingContext";
import { formatAmount, getHFColor, getHFDisplay, timeAgo } from "../utils/formatters";

const ACTION_ICONS = {
  deposit: { Icon: ArrowDownLeft, color: "text-primary", label: "Deposit" },
  withdraw: { Icon: ArrowUpRight, color: "text-warning", label: "Withdraw" },
  borrow: { Icon: ArrowDownLeft, color: "text-secondary", label: "Borrow" },
  repay: { Icon: Repeat, color: "text-primary", label: "Repay" },
  liquidate: { Icon: Hammer, color: "text-danger", label: "Liquidate" },
};

export default function TransactionHistory() {
  const { transactions } = useLendingContext();

  if (transactions.length === 0) {
    return (
      <div className="bg-gray-900/70 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-text-secondary" />
          <h2 className="text-lg font-semibold">Transaction History</h2>
        </div>
        <p className="text-sm text-text-secondary text-center py-8">
          No transactions yet. Start by depositing or borrowing assets.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/70 backdrop-blur-lg border border-white/10 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-white/10">
        <Clock className="w-5 h-5 text-text-secondary" />
        <h2 className="text-lg font-semibold">Transaction History</h2>
        <span className="ml-auto text-xs text-text-secondary">{transactions.length} transactions</span>
      </div>

      <div className="divide-y divide-white/5">
        {transactions.map((tx) => {
          const action = ACTION_ICONS[tx.type] || ACTION_ICONS.deposit;
          return (
            <div key={tx.id} className="flex items-center gap-4 px-6 py-3 hover:bg-white/5 transition-colors">
              <div className={`w-8 h-8 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center shrink-0`}>
                <action.Icon className={`w-4 h-4 ${action.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{action.label}</div>
                <div className="text-xs text-text-secondary">
                  {formatAmount(tx.amount, tx.symbol)} {tx.symbol}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-xs font-mono ${getHFColor(tx.hfBefore)}`}>
                  HF {getHFDisplay(tx.hfBefore)}
                </div>
                <div className="text-xs text-text-secondary">{timeAgo(tx.timestamp)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
