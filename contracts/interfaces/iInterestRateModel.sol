// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IInterestRateModel
 * @notice interface for pluggable interest rate strategies.
*/
interface IInterestRateModel {
  /**
   * @notice returns the annualized borrow rate in WAD (1e18 = 100%)
   * @param totalDeposits total deposits in the pool (native token units)
   * @param totalBorrows total borrows from the pool (native token units)
   * @return annualized borrow rate in WAD
   */
  function getBorrowRate(uint256 totalDeposits, uint256 totalBorrows) external view returns (uint256);

  /**
   * @notice returns the annualized supply rate in WAD
   * @param totalDeposits total deposits in the pool (native token units)
   * @param totalBorrows total borrows from the pool (native token units)
   * @return annualized supply rate in WAD
   */ 
  function getSupplyRate(uint256 totalDeposits, uint256 totalBorrows) external view returns (uint256);
}
