// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contacts/utils/Reentrancyguard.sol";
import "@openzeppelin/contacts/token/ERC20/IERC20.sol";
import "@openzeppelin/contacts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/iLendingPool.sol";
import "./interfaces/iInterestRateModel.sol";
import "./interfaces/iPriceOracle.sol";
import "./libraries/wadMath.sol";

/**
 * @title LendingPool
 * @notice Core lending pool contract supporting deposit, withdraw, borrow, repay.
 * @dev Uses scaled balances and cumulative indexes for on-demand interest accrual.
 */
contract LendingPool is ILendingPool, Ownable, ReentrancyGuard {
    using WadMath for uint256;
    using SafeERC20 for IERC20;

    // ──────────────────── Data Structures ────────────────────

    struct AssetConfig {
        bool isActive;
        uint8 decimals;
        uint16 ltvBps;                   // e.g. 8000 = 80%
        uint16 liquidationThresholdBps;  // e.g. 8500 = 85%
        uint16 liquidationBonusBps;      // e.g. 500 = 5%
        uint256 totalDeposits;           // in native token units
        uint256 totalBorrows;            // in native token units
        uint256 borrowIndex;             // cumulative, starts at 1e18
        uint256 supplyIndex;             // cumulative, starts at 1e18
        uint256 lastUpdateTimestamp;
    }

    struct UserPosition {
        uint256 depositScaled;   // deposit amount scaled by supplyIndex
        uint256 borrowScaled;    // borrow amount scaled by borrowIndex
    }

    // ──────────────────── State ────────────────────

    mapping(address => AssetConfig) public assetConfigs;
    address[] public supportedAssets;
    mapping(address => mapping(address => UserPosition)) private _userPositions;

    IInterestRateModel public interestRateModel;
    IPriceOracle public priceOracle;

    // ──────────────────── Events ────────────────────

    event Deposit(address indexed user, address indexed asset, uint256 amount);
    event Withdraw(address indexed user, address indexed asset, uint256 amount);
    event Borrow(address indexed user, address indexed asset, uint256 amount);
    event Repay(address indexed user, address indexed asset, uint256 amount);
    event Liquidation(
        address indexed borrower,
        address indexed liquidator,
        address debtAsset,
        address collateralAsset,
        uint256 debtRepaid,
        uint256 collateralSeized
    );
    event AssetAdded(address indexed asset, uint16 ltvBps, uint16 liquidationThresholdBps);
    event InterestAccrued(address indexed asset, uint256 borrowIndex, uint256 supplyIndex);
    event OracleUpdated(address indexed newOracle);
    event InterestRateModelUpdated(address indexed newModel);

    // ──────────────────── Constructor ────────────────────

    constructor(
        address _priceOracle,
        address _interestRateModel,
        address _owner
    ) Ownable(_owner) {
        require(_priceOracle != address(0), "LendingPool: zero oracle");
        require(_interestRateModel != address(0), "LendingPool: zero rate model");
        priceOracle = IPriceOracle(_priceOracle);
        interestRateModel = IInterestRateModel(_interestRateModel);
    }

    // ──────────────────── Admin ────────────────────

    function addAsset(
        address asset,
        uint8 decimals_,
        uint16 ltvBps,
        uint16 liquidationThresholdBps,
        uint16 liquidationBonusBps
    ) external onlyOwner {
        require(!assetConfigs[asset].isActive, "LendingPool: asset already active");
        require(ltvBps <= liquidationThresholdBps, "LendingPool: LTV > threshold");
        require(liquidationThresholdBps <= 10000, "LendingPool: threshold > 100%");

        assetConfigs[asset] = AssetConfig({
            isActive: true,
            decimals: decimals_,
            ltvBps: ltvBps,
            liquidationThresholdBps: liquidationThresholdBps,
            liquidationBonusBps: liquidationBonusBps,
            totalDeposits: 0,
            totalBorrows: 0,
            borrowIndex: WadMath.WAD,
            supplyIndex: WadMath.WAD,
            lastUpdateTimestamp: block.timestamp
        });
        supportedAssets.push(asset);

        emit AssetAdded(asset, ltvBps, liquidationThresholdBps);
    }

    function setOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "LendingPool: zero oracle");
        priceOracle = IPriceOracle(newOracle);
        emit OracleUpdated(newOracle);
    }

    function setInterestRateModel(address newModel) external onlyOwner {
        require(newModel != address(0), "LendingPool: zero rate model");
        interestRateModel = IInterestRateModel(newModel);
        emit InterestRateModelUpdated(newModel);
    }

    // ──────────────────── Core Actions ────────────────────

    /// @inheritdoc ILendingPool
    function deposit(address asset, uint256 amount) external override nonReentrant {
        AssetConfig storage config = assetConfigs[asset];
        require(config.isActive, "LendingPool: asset not active");
        require(amount > 0, "LendingPool: zero amount");

        _accrueInterest(asset);

        // Transfer tokens from user to pool
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);

        // Scale the deposit amount and record
        uint256 scaledAmount = amount * WadMath.WAD / config.supplyIndex;
        _userPositions[msg.sender][asset].depositScaled += scaledAmount;
        config.totalDeposits += amount;

        emit Deposit(msg.sender, asset, amount);
    }

    /// @inheritdoc ILendingPool
    function withdraw(address asset, uint256 amount) external override nonReentrant {
        AssetConfig storage config = assetConfigs[asset];
        require(config.isActive, "LendingPool: asset not active");
        require(amount > 0, "LendingPool: zero amount");

        _accrueInterest(asset);

        UserPosition storage pos = _userPositions[msg.sender][asset];
        uint256 currentDeposit = pos.depositScaled * config.supplyIndex / WadMath.WAD;
        require(amount <= currentDeposit, "LendingPool: insufficient deposit");

        // Calculate scaled amount to remove
        uint256 scaledAmount = amount * WadMath.WAD / config.supplyIndex;
        pos.depositScaled -= scaledAmount;
        config.totalDeposits -= amount;

        // Check health factor after withdrawal
        uint256 hf = _calculateHealthFactor(msg.sender);
        require(hf >= WadMath.WAD, "LendingPool: withdrawal would cause liquidation");

        // Transfer tokens to user
        IERC20(asset).safeTransfer(msg.sender, amount);

        emit Withdraw(msg.sender, asset, amount);
    }

    /// @inheritdoc ILendingPool
    function borrow(address asset, uint256 amount) external override nonReentrant {
        AssetConfig storage config = assetConfigs[asset];
        require(config.isActive, "LendingPool: asset not active");
        require(amount > 0, "LendingPool: zero amount");
        require(
            amount <= config.totalDeposits - config.totalBorrows,
            "LendingPool: insufficient liquidity"
        );

        _accrueInterest(asset);

        // Scale the borrow and record
        uint256 scaledAmount = amount * WadMath.WAD / config.borrowIndex;
        _userPositions[msg.sender][asset].borrowScaled += scaledAmount;
        config.totalBorrows += amount;

        // Check health factor after borrow
        uint256 hf = _calculateHealthFactor(msg.sender);
        require(hf >= WadMath.WAD, "LendingPool: borrow would cause liquidation");

        // Transfer tokens to borrower
        IERC20(asset).safeTransfer(msg.sender, amount);

        emit Borrow(msg.sender, asset, amount);
    }

    /// @inheritdoc ILendingPool
    function repay(address asset, uint256 amount) external override nonReentrant {
        AssetConfig storage config = assetConfigs[asset];
        require(config.isActive, "LendingPool: asset not active");
        require(amount > 0, "LendingPool: zero amount");

        _accrueInterest(asset);

        UserPosition storage pos = _userPositions[msg.sender][asset];
        uint256 currentBorrow = pos.borrowScaled * config.borrowIndex / WadMath.WAD;

        // Cap repayment to outstanding debt
        uint256 actualRepay = amount > currentBorrow ? currentBorrow : amount;
        require(actualRepay > 0, "LendingPool: nothing to repay");

        // Transfer tokens from user to pool
        IERC20(asset).safeTransferFrom(msg.sender, address(this), actualRepay);

        // Update scaled borrow
        uint256 scaledRepay = actualRepay * WadMath.WAD / config.borrowIndex;
        pos.borrowScaled -= scaledRepay;
        config.totalBorrows -= actualRepay;

        emit Repay(msg.sender, asset, actualRepay);
    }

    // ──────────────────── Liquidation (Bonus) ────────────────────

    /**
     * @notice Liquidate an undercollateralized position.
     * @param borrower       The address of the borrower to liquidate.
     * @param debtAsset      The token the liquidator repays.
     * @param debtAmount     The amount of debt to repay (up to close factor).
     * @param collateralAsset The collateral token to seize.
     */
    function liquidate(
        address borrower,
        address debtAsset,
        uint256 debtAmount,
        address collateralAsset
    ) external nonReentrant {
        require(borrower != msg.sender, "LendingPool: cannot self-liquidate");
        require(debtAmount > 0, "LendingPool: zero debt amount");

        _accrueInterest(debtAsset);
        _accrueInterest(collateralAsset);

        // Verify borrower is liquidatable (HF < 1.0)
        require(
            _calculateHealthFactor(borrower) < WadMath.WAD,
            "LendingPool: health factor >= 1"
        );

        // Validate and calculate amounts
        uint256 collateralSeized = _validateAndCalcLiquidation(
            borrower, debtAsset, debtAmount, collateralAsset
        );

        // Execute: repay debt on behalf of borrower
        _executeLiquidation(borrower, debtAsset, debtAmount, collateralAsset, collateralSeized);

        emit Liquidation(borrower, msg.sender, debtAsset, collateralAsset, debtAmount, collateralSeized);
    }

    function _validateAndCalcLiquidation(
        address borrower,
        address debtAsset,
        uint256 debtAmount,
        address collateralAsset
    ) internal view returns (uint256 collateralSeized) {
        AssetConfig storage debtConfig = assetConfigs[debtAsset];

        // Enforce close factor: can only repay up to 50% of the borrower's debt
        uint256 currentDebt = _userPositions[borrower][debtAsset].borrowScaled
            * debtConfig.borrowIndex / WadMath.WAD;
        require(debtAmount <= currentDebt / 2, "LendingPool: exceeds close factor");

        // Calculate collateral to seize
        uint256 debtPrice = priceOracle.getAssetPrice(debtAsset);
        uint256 debtValueUSD = debtAmount * debtPrice / (10 ** debtConfig.decimals);

        AssetConfig storage colConfig = assetConfigs[collateralAsset];
        uint256 colPrice = priceOracle.getAssetPrice(collateralAsset);
        collateralSeized = debtValueUSD
            * (10000 + colConfig.liquidationBonusBps) / 10000
            * (10 ** colConfig.decimals) / colPrice;

        // Verify borrower has enough collateral
        uint256 borrowerCol = _userPositions[borrower][collateralAsset].depositScaled
            * colConfig.supplyIndex / WadMath.WAD;
        require(collateralSeized <= borrowerCol, "LendingPool: insufficient collateral");
    }

    function _executeLiquidation(
        address borrower,
        address debtAsset,
        uint256 debtAmount,
        address collateralAsset,
        uint256 collateralSeized
    ) internal {
        AssetConfig storage debtConfig = assetConfigs[debtAsset];
        AssetConfig storage colConfig = assetConfigs[collateralAsset];

        // Transfer debt tokens from liquidator to pool
        IERC20(debtAsset).safeTransferFrom(msg.sender, address(this), debtAmount);

        // Update borrower's debt
        uint256 scaledRepay = debtAmount * WadMath.WAD / debtConfig.borrowIndex;
        _userPositions[borrower][debtAsset].borrowScaled -= scaledRepay;
        debtConfig.totalBorrows -= debtAmount;

        // Seize collateral from borrower and transfer to liquidator
        uint256 scaledSeize = collateralSeized * WadMath.WAD / colConfig.supplyIndex;
        _userPositions[borrower][collateralAsset].depositScaled -= scaledSeize;
        colConfig.totalDeposits -= collateralSeized;
        IERC20(collateralAsset).safeTransfer(msg.sender, collateralSeized);
    }

    // ──────────────────── View Functions ────────────────────

    /// @inheritdoc ILendingPool
    function getHealthFactor(address user) external view override returns (uint256) {
        return _calculateHealthFactorView(user);
    }

    /// @inheritdoc ILendingPool
    function getUserPosition(
        address user,
        address asset
    ) external view override returns (uint256 deposited, uint256 borrowed) {
        (uint256 si, uint256 bi) = _getProjectedIndexes(asset);
        UserPosition storage pos = _userPositions[user][asset];
        deposited = pos.depositScaled * si / WadMath.WAD;
        borrowed = pos.borrowScaled * bi / WadMath.WAD;
    }

    /// @inheritdoc ILendingPool
    function getAssetData(
        address asset
    )
        external
        view
        override
        returns (uint256 totalDeposits, uint256 totalBorrows, uint256 supplyRate, uint256 borrowRate)
    {
        AssetConfig storage config = assetConfigs[asset];
        totalDeposits = config.totalDeposits;
        totalBorrows = config.totalBorrows;
        borrowRate = interestRateModel.getBorrowRate(totalDeposits, totalBorrows);
        supplyRate = interestRateModel.getSupplyRate(totalDeposits, totalBorrows);
    }

    /// @inheritdoc ILendingPool
    function getUserAccountData(
        address user
    )
        external
        view
        override
        returns (
            uint256 totalCollateralUSD,
            uint256 totalDebtUSD,
            uint256 availableBorrowUSD,
            uint256 healthFactor
        )
    {
        uint256 totalBorrowPowerUSD;
        (totalCollateralUSD, totalDebtUSD, totalBorrowPowerUSD) = _calculateAccountDataView(user);
        availableBorrowUSD = totalBorrowPowerUSD > totalDebtUSD
            ? totalBorrowPowerUSD - totalDebtUSD
            : 0;
        healthFactor = _calculateHealthFactorView(user);
    }

    function getSupportedAssets() external view returns (address[] memory) {
        return supportedAssets;
    }

    // ──────────────────── Internal: Interest Accrual ────────────────────

    /**
     * @dev Accrue interest for an asset. Called before any state-changing operation.
     */
    function _accrueInterest(address asset) internal {
        AssetConfig storage config = assetConfigs[asset];

        if (block.timestamp == config.lastUpdateTimestamp) return;
        if (config.totalDeposits == 0) {
            config.lastUpdateTimestamp = block.timestamp;
            return;
        }

        uint256 timeElapsed = block.timestamp - config.lastUpdateTimestamp;

        // Get annualized borrow rate and compute per-second interest factor
        uint256 borrowRatePerYear = interestRateModel.getBorrowRate(
            config.totalDeposits,
            config.totalBorrows
        );
        uint256 interestFactor = borrowRatePerYear * timeElapsed / WadMath.SECONDS_PER_YEAR;

        if (interestFactor > 0 && config.totalBorrows > 0) {
            // Update borrow index
            uint256 borrowIndexIncrease = config.borrowIndex * interestFactor / WadMath.WAD;
            config.borrowIndex += borrowIndexIncrease;

            // Calculate interest accrued on borrows
            uint256 interestAccrued = config.totalBorrows * interestFactor / WadMath.WAD;
            config.totalBorrows += interestAccrued;

            // Update supply index (interest flows from borrowers to depositors)
            uint256 supplyInterestFactor = interestFactor * config.totalBorrows / config.totalDeposits;
            uint256 supplyIndexIncrease = config.supplyIndex * supplyInterestFactor / WadMath.WAD;
            config.supplyIndex += supplyIndexIncrease;

            emit InterestAccrued(asset, config.borrowIndex, config.supplyIndex);
        }

        config.lastUpdateTimestamp = block.timestamp;
    }

    /**
     * @dev Project what the indexes would be at the current timestamp, without writing state.
     *      Used by view functions to return accurate real-time data.
     */
    function _getProjectedIndexes(address asset) internal view returns (uint256 supplyIndex, uint256 borrowIndex) {
        AssetConfig storage config = assetConfigs[asset];
        supplyIndex = config.supplyIndex;
        borrowIndex = config.borrowIndex;

        if (block.timestamp == config.lastUpdateTimestamp || config.totalDeposits == 0) {
            return (supplyIndex, borrowIndex);
        }

        uint256 timeElapsed = block.timestamp - config.lastUpdateTimestamp;
        uint256 borrowRatePerYear = interestRateModel.getBorrowRate(
            config.totalDeposits,
            config.totalBorrows
        );
        uint256 interestFactor = borrowRatePerYear * timeElapsed / WadMath.SECONDS_PER_YEAR;

        if (interestFactor > 0 && config.totalBorrows > 0) {
            borrowIndex += borrowIndex * interestFactor / WadMath.WAD;
            uint256 supplyInterestFactor = interestFactor * config.totalBorrows / config.totalDeposits;
            supplyIndex += supplyIndex * supplyInterestFactor / WadMath.WAD;
        }
    }

    // ──────────────────── Internal: Health Factor ────────────────────

    /**
     * @dev Calculate health factor using current (already accrued) indexes.
     *      Used after state changes (deposit/withdraw/borrow/repay).
     */
    function _calculateHealthFactor(address user) internal view returns (uint256) {
        uint256 totalCollateralUSD = 0;
        uint256 totalDebtUSD = 0;

        for (uint256 i = 0; i < supportedAssets.length; i++) {
            address asset = supportedAssets[i];
            AssetConfig storage config = assetConfigs[asset];
            UserPosition storage pos = _userPositions[user][asset];

            if (pos.depositScaled > 0) {
                uint256 realDeposit = pos.depositScaled * config.supplyIndex / WadMath.WAD;
                uint256 assetPrice = priceOracle.getAssetPrice(asset);
                // depositUSD in WAD: realDeposit * price / 10^decimals
                uint256 depositUSD = realDeposit * assetPrice / (10 ** config.decimals);
                // Weight by liquidation threshold
                totalCollateralUSD += depositUSD * config.liquidationThresholdBps / 10000;
            }

            if (pos.borrowScaled > 0) {
                uint256 realBorrow = pos.borrowScaled * config.borrowIndex / WadMath.WAD;
                uint256 assetPrice = priceOracle.getAssetPrice(asset);
                uint256 borrowUSD = realBorrow * assetPrice / (10 ** config.decimals);
                totalDebtUSD += borrowUSD;
            }
        }

        if (totalDebtUSD == 0) return type(uint256).max;
        return totalCollateralUSD.wadDiv(totalDebtUSD);
    }

    /**
     * @dev Calculate health factor using projected indexes (for view functions).
     */
    function _calculateHealthFactorView(address user) internal view returns (uint256) {
        uint256 totalCollateralUSD = 0;
        uint256 totalDebtUSD = 0;

        for (uint256 i = 0; i < supportedAssets.length; i++) {
            address asset = supportedAssets[i];
            AssetConfig storage config = assetConfigs[asset];
            UserPosition storage pos = _userPositions[user][asset];

            (uint256 si, uint256 bi) = _getProjectedIndexes(asset);

            if (pos.depositScaled > 0) {
                uint256 realDeposit = pos.depositScaled * si / WadMath.WAD;
                uint256 assetPrice = priceOracle.getAssetPrice(asset);
                uint256 depositUSD = realDeposit * assetPrice / (10 ** config.decimals);
                totalCollateralUSD += depositUSD * config.liquidationThresholdBps / 10000;
            }

            if (pos.borrowScaled > 0) {
                uint256 realBorrow = pos.borrowScaled * bi / WadMath.WAD;
                uint256 assetPrice = priceOracle.getAssetPrice(asset);
                uint256 borrowUSD = realBorrow * assetPrice / (10 ** config.decimals);
                totalDebtUSD += borrowUSD;
            }
        }

        if (totalDebtUSD == 0) return type(uint256).max;
        return totalCollateralUSD.wadDiv(totalDebtUSD);
    }

    /**
     * @dev Calculate account data with projected indexes: collateral, debt, borrow power (LTV-based).
     */
    function _calculateAccountDataView(address user)
        internal
        view
        returns (uint256 totalCollateralUSD, uint256 totalDebtUSD, uint256 totalBorrowPowerUSD)
    {
        for (uint256 i = 0; i < supportedAssets.length; i++) {
            address asset = supportedAssets[i];
            AssetConfig storage config = assetConfigs[asset];
            UserPosition storage pos = _userPositions[user][asset];

            (uint256 si, uint256 bi) = _getProjectedIndexes(asset);

            if (pos.depositScaled > 0) {
                uint256 realDeposit = pos.depositScaled * si / WadMath.WAD;
                uint256 assetPrice = priceOracle.getAssetPrice(asset);
                uint256 depositUSD = realDeposit * assetPrice / (10 ** config.decimals);
                totalCollateralUSD += depositUSD;
                totalBorrowPowerUSD += depositUSD * config.ltvBps / 10000;
            }

            if (pos.borrowScaled > 0) {
                uint256 realBorrow = pos.borrowScaled * bi / WadMath.WAD;
                uint256 assetPrice = priceOracle.getAssetPrice(asset);
                uint256 borrowUSD = realBorrow * assetPrice / (10 ** config.decimals);
                totalDebtUSD += borrowUSD;
            }
        }
    }
}
