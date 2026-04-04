// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WadMath
 * @notice Fixed-point arithmetic library using WAD (1e18) precision.
 * @dev All functions are internal pure — they get inlined by the compiler.
 */
library WadMath {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant HALF_WAD = 0.5e18;
    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    /**
     * @notice Multiplies two WAD values: (a * b + WAD/2) / WAD
     */
    function wadMul(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a * b + HALF_WAD) / WAD;
    }

    /**
     * @notice Divides two WAD values: (a * WAD + b/2) / b
     */
    function wadDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "WadMath: division by zero");
        return (a * WAD + b / 2) / b;
    }
}
