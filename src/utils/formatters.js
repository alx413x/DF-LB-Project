// Format a number as USD currency. Use compact=true for large numbers (e.g., $1.2M)
export function formatUSD(value, compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact && value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(value);
}

// Format a decimal as percentage (e.g., 0.0523 -> "5.23%")
export function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

// Format token amount based on symbol precision (USDC: 2 decimals, others: 4)
export function formatAmount(value, symbol) {
  if (symbol === "USDC") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  }
  return value.toFixed(4);
}

// Shorten Ethereum address: 0x1234...5678
export function truncateAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// Return Tailwind color class based on health factor value
// >1.5: safe (green), >1.1: warning (yellow), <=1.1: danger (red)
export function getHFColor(hf) {
  if (hf === Infinity) return "text-primary";
  if (hf > 1.5) return "text-primary";
  if (hf > 1.1) return "text-warning";
  return "text-danger";
}

// Format health factor for display (Infinity shows as ∞)
export function getHFDisplay(hf) {
  if (hf === Infinity) return "∞";
  return hf.toFixed(2);
}

// Convert timestamp to relative time string (e.g., "5m ago", "2h ago")
export function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
