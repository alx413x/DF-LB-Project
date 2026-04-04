// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IPriceOracle.sol";

/**
 * @title PriceOracle
 * @notice Hardcoded price oracle. Owner can update prices.
 *         Upgradeable to Chainlink as a bonus feature.
 */
contract PriceOracle is IPriceOracle, Ownable {
    mapping(address => uint256) private _prices;

    event PriceUpdated(address indexed asset, uint256 newPrice);

    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Set the USD price of an asset in WAD (18 decimals).
     * @param asset Token address.
     * @param priceInWad Price in USD with 18 decimal precision (e.g. 2450e18 for ETH).
     */
    function setAssetPrice(address asset, uint256 priceInWad) external onlyOwner {
        require(priceInWad > 0, "PriceOracle: price must be > 0");
        _prices[asset] = priceInWad;
        emit PriceUpdated(asset, priceInWad);
    }

    /// @inheritdoc IPriceOracle
    function getAssetPrice(address asset) external view override returns (uint256) {
        uint256 price = _prices[asset];
        require(price > 0, "PriceOracle: price not set");
        return price;
    }
}
