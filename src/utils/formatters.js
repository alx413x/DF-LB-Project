export function formatUSD(value, compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact && value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatAmount(value, symbol) {
  if (symbol === "USDC") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  }
  return value.toFixed(4);
}

export function truncateAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function getHFColor(hf) {
  if (hf === Infinity) return "text-primary";
  if (hf > 1.5) return "text-primary";
  if (hf > 1.1) return "text-warning";
  return "text-danger";
}

export function getHFDisplay(hf) {
  if (hf === Infinity) return "∞";
  return hf.toFixed(2);
}

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
