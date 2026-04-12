import { createPortal } from "react-dom";
import { X, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { useLendingContext } from "../context/useLendingContext";

const ICON_MAP = {
  success: { Icon: CheckCircle, color: "text-primary" },
  error: { Icon: AlertTriangle, color: "text-danger" },
  warning: { Icon: AlertTriangle, color: "text-warning" },
  info: { Icon: Info, color: "text-secondary" },
};

export default function Toast() {
  const { toasts, removeToast } = useLendingContext();

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="fixed top-4 right-4 z-100 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const { Icon, color } = ICON_MAP[toast.type] || ICON_MAP.success;
        return (
          <div
            key={toast.id}
            className="flex items-center gap-3 bg-gray-900/95 backdrop-blur-lg border border-white/10 rounded-xl px-4 py-3 shadow-2xl toast-slide-in"
          >
            <Icon className={`w-5 h-5 shrink-0 ${color}`} />
            <span className="text-sm text-white flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-text-secondary" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
}
