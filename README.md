# DeFi Lending Protocol

## Prerequisites

- Node.js >= 18
- npm >= 9

## Install Dependencies

```bash
npm install
```

## Smart Contracts

The smart contract system consists of **8 Solidity files** organized in a modular architecture:

```
contracts/
├── LendingPool.sol        # Core: deposit, withdraw, borrow, repay, liquidate
├── InterestRateModel.sol  # Kinked interest rate model (2% base, 80% optimal utilization)
├── PriceOracle.sol        # Price feed for USD valuation
├── MockERC20.sol          # Test tokens (USDC, WETH)
├── interfaces/
│   ├── ILendingPool.sol
│   ├── IInterestRateModel.sol
│   └── IPriceOracle.sol
└── libraries/
    └── WadMath.sol        # Fixed-point arithmetic (WAD = 1e18)
```

### Key Components

| Contract | Purpose |
|----------|---------|
| **LendingPool** | Core lending operations, interest accrual, health factor calculation, liquidation |
| **InterestRateModel** | Kinked rate model: 2% base + 4%/75% slopes at 80% utilization kink |
| **PriceOracle** | Manages asset prices in WAD format (USDC=$1, WETH=$2450) |
| **WadMath** | Fixed-point math library for precise interest calculations |

### Risk Parameters

| Asset | LTV | Liquidation Threshold | Liquidation Bonus |
|-------|-----|----------------------|-------------------|
| USDC | 80% | 85% | 5% |
| WETH | 75% | 82% | 10% |

## Manual Test Procedure

### Compile Contracts

```bash
npx hardhat --config hardhat.config.cjs compile
```

### Deploy Contracts (Local)

Start a local Hardhat node in one terminal:

```bash
npx hardhat --config hardhat.config.cjs node
```

Deploy contracts in another terminal:

```bash
npx hardhat run scripts/deploy.cjs 
```

The deploy script will output all contract addresses and write them to `src/contracts/addresses.json` for frontend use.

## Frontend

### Start Development Server

```bash
npm run dev
```
