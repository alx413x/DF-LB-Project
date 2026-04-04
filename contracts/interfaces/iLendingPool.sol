// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ILendingPool
 * @notice interface for the core lending pool contract.
 */
interface ILendingPool {
    // ──────────────────── Core Actions ────────────────────

    function deposit(address asset, uint256 amount) external;
    function withdraw(address asset, uint256 amount) external;
    function borrow(address asset, uint256 amount) external;
    function repay(address asset, uint256 amount) external;

    // ──────────────────── View Functions ────────────────────

    /**
     * @notice Returns the health factor of a user in WAD (1e18 = 1.0).
     *         Returns type(uint256).max if user has no debt.
     */
    function getHealthFactor(address user) external view returns (uint256);

    /**
     * @notice Returns a user's actual (not scaled) deposit and borrow for an asset,
     *         including accrued interest up to the current block timestamp.
     */
    function getUserPosition(address user, address asset)
        external
        view
        returns (uint256 deposited, uint256 borrowed);

    /**
     * @notice Returns pool-level data for an asset.
     */
    function getAssetData(address asset)
        external
        view
        returns (
            uint256 totalDeposits,
            uint256 totalBorrows,
            uint256 supplyRate,
            uint256 borrowRate
        );

    /**
     * @notice One-stop dashboard getter for a user's aggregate position.
     */
    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralUSD,
            uint256 totalDebtUSD,
            uint256 availableBorrowUSD,
            uint256 healthFactor
        );
}
