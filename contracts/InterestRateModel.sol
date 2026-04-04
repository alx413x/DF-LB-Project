// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IInterestRateModel.sol";
import "./libraries/WadMath.sol";

/**
 * @title InterestRateModel
 * @notice Kinked (two-slope) interest rate model.
 * @dev Matches the frontend mockData.js parameters exactly:
 *      BASE_RATE = 2%, SLOPE_1 = 4%, SLOPE_2 = 75%, OPTIMAL_UTILIZATION = 80%
 *
 *      Below optimal:  borrowRate = BASE_RATE + (utilization / optimal) * SLOPE_1
 *      Above optimal:  borrowRate = BASE_RATE + SLOPE_1 + ((utilization - optimal) / (1 - optimal)) * SLOPE_2
 *      Supply rate:    supplyRate = borrowRate * utilization
 */
contract InterestRateModel is IInterestRateModel {
    using WadMath for uint256;

    uint256 public constant BASE_RATE = 0.02e18;              // 2%
    uint256 public constant SLOPE_1 = 0.04e18;                // 4%
    uint256 public constant SLOPE_2 = 0.75e18;                // 75%
    uint256 public constant OPTIMAL_UTILIZATION = 0.80e18;    // 80%
    uint256 public constant MAX_EXCESS_UTILIZATION = 0.20e18; // 1 - 80% = 20%

    /// @inheritdoc IInterestRateModel
    function getBorrowRate(
        uint256 totalDeposits,
        uint256 totalBorrows
    ) external pure override returns (uint256) {
        if (totalDeposits == 0) return BASE_RATE;

        uint256 utilization = totalBorrows.wadDiv(totalDeposits);

        if (utilization <= OPTIMAL_UTILIZATION) {
            // Below kink: BASE_RATE + (utilization / optimal) * SLOPE_1
            return BASE_RATE + utilization.wadDiv(OPTIMAL_UTILIZATION).wadMul(SLOPE_1);
        } else {
            // Above kink: BASE_RATE + SLOPE_1 + ((utilization - optimal) / maxExcess) * SLOPE_2
            uint256 excessUtilization = utilization - OPTIMAL_UTILIZATION;
            return BASE_RATE + SLOPE_1 + excessUtilization.wadDiv(MAX_EXCESS_UTILIZATION).wadMul(SLOPE_2);
        }
    }

    /// @inheritdoc IInterestRateModel
    function getSupplyRate(
        uint256 totalDeposits,
        uint256 totalBorrows
    ) external pure override returns (uint256) {
        if (totalDeposits == 0) return 0;

        uint256 utilization = totalBorrows.wadDiv(totalDeposits);
        uint256 borrowRate = _getBorrowRateInternal(totalDeposits, totalBorrows);
        return borrowRate.wadMul(utilization);
    }

    function _getBorrowRateInternal(
        uint256 totalDeposits,
        uint256 totalBorrows
    ) internal pure returns (uint256) {
        if (totalDeposits == 0) return BASE_RATE;

        uint256 utilization = totalBorrows.wadDiv(totalDeposits);

        if (utilization <= OPTIMAL_UTILIZATION) {
            return BASE_RATE + utilization.wadDiv(OPTIMAL_UTILIZATION).wadMul(SLOPE_1);
        } else {
            uint256 excessUtilization = utilization - OPTIMAL_UTILIZATION;
            return BASE_RATE + SLOPE_1 + excessUtilization.wadDiv(MAX_EXCESS_UTILIZATION).wadMul(SLOPE_2);
        }
    }
}
