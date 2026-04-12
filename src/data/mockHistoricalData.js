// Generate 30 days of synthetic historical data for charts
function generateHistory(baseSupplyAPY, baseBorrowAPY, baseUtilization) {
  const data = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  let supplyAPY = baseSupplyAPY;
  let borrowAPY = baseBorrowAPY;
  let utilization = baseUtilization;

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now - i * dayMs);
    const label = `${date.getMonth() + 1}/${date.getDate()}`;

    // Random walk with mean reversion toward base values
    supplyAPY += (Math.random() - 0.5) * 0.005 + (baseSupplyAPY - supplyAPY) * 0.1;
    borrowAPY += (Math.random() - 0.5) * 0.008 + (baseBorrowAPY - borrowAPY) * 0.1;
    utilization += (Math.random() - 0.5) * 0.03 + (baseUtilization - utilization) * 0.1;

    supplyAPY = Math.max(0.001, supplyAPY);
    borrowAPY = Math.max(0.005, borrowAPY);
    utilization = Math.max(0.1, Math.min(0.95, utilization));

    data.push({
      date: label,
      supplyAPY: parseFloat((supplyAPY * 100).toFixed(2)),
      borrowAPY: parseFloat((borrowAPY * 100).toFixed(2)),
      utilization: parseFloat((utilization * 100).toFixed(1)),
    });
  }
  return data;
}

export const HISTORICAL_DATA = {
  USDC: generateHistory(0.0385, 0.055, 0.7),
  ETH: generateHistory(0.016, 0.04, 0.4),
};
