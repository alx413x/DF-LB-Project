// Interest rate model constants (Kinked model)
// Used by InterestRateCurve chart for rendering the theoretical curve
export const BASE_RATE = 0.02;
export const SLOPE_1 = 0.04;
export const SLOPE_2 = 0.75;
export const OPTIMAL_UTILIZATION = 0.8;

// Calculate borrow APY from utilization rate using kinked model
export function calculateBorrowAPY(utilization) {
  if (utilization <= OPTIMAL_UTILIZATION) {
    return BASE_RATE + (utilization / OPTIMAL_UTILIZATION) * SLOPE_1;
  }
  return (
    BASE_RATE +
    SLOPE_1 +
    ((utilization - OPTIMAL_UTILIZATION) / (1 - OPTIMAL_UTILIZATION)) * SLOPE_2
  );
}

// Supply APY = borrowRate * utilization (lenders earn proportional to utilization)
export function calculateSupplyAPY(utilization) {
  return calculateBorrowAPY(utilization) * utilization;
}
