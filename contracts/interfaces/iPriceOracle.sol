// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title iPriceOracle
 * @notice Interface for asset price feeds.
 */
interface iPriceOracle {
    /**
     * @notice Returns the price of an asset in USD, denominated in WAD (18 decimals).
     * @dev e.g. USDC = 1e18, ETH = 2450e18
     * @param asset The token address.
     * @return Price in USD with 18 decimal precision.
     */
    function getAssetPrice(address asset) external view returns (uint256);
}
