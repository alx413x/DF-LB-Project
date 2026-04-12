import { ethers } from "ethers";
import addresses from "../contracts/addresses.json";
import LendingPoolABI from "../contracts/abis/LendingPool.json";
import MockERC20ABI from "../contracts/abis/MockERC20.json";
import PriceOracleABI from "../contracts/abis/PriceOracle.json";

// ──────────────────── Asset Registry ────────────────────

export const ASSET_CONFIG = [
  {
    address: addresses.MockUSDC,
    symbol: "USDC",
    name: "USD Coin",
  },
  {
    address: addresses.MockWETH,
    symbol: "ETH",
    name: "Wrapped Ether",
  },
];

const LENDING_POOL_ADDRESS = addresses.LendingPool;

// ──────────────────── WAD / Decimal Helpers ────────────────────

function wadToFloat(wadBigInt) {
  return parseFloat(ethers.formatEther(wadBigInt));
}

function bpsToFraction(bps) {
  return Number(bps) / 10000;
}

function formatTokenAmount(bigintValue, decimals) {
  return parseFloat(ethers.formatUnits(bigintValue, decimals));
}

const MAX_UINT256 = ethers.MaxUint256;

// ──────────────────── Provider Management ────────────────────

export function getReadProvider() {
  return new ethers.JsonRpcProvider("http://127.0.0.1:8545");
}

export async function connectWallet() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask not found. Please install MetaMask browser extension.");
  }

  // Use wallet_requestPermissions to ALWAYS show the MetaMask popup
  // ("Connect this website with MetaMask"), even if previously authorized.
  // eth_requestAccounts silently returns accounts when already connected.
  await window.ethereum.request({
    method: "wallet_requestPermissions",
    params: [{ eth_accounts: {} }],
  });

  // After user confirms, retrieve the selected accounts
  const accounts = await window.ethereum.request({ method: "eth_accounts" });
  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts returned. Please unlock MetaMask.");
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { provider, signer, address };
}

// ──────────────────── Contract Factories ────────────────────

export function getLendingPool(signerOrProvider) {
  return new ethers.Contract(LENDING_POOL_ADDRESS, LendingPoolABI, signerOrProvider);
}

export function getERC20(tokenAddress, signerOrProvider) {
  return new ethers.Contract(tokenAddress, MockERC20ABI, signerOrProvider);
}

export function getPriceOracle(signerOrProvider) {
  return new ethers.Contract(addresses.PriceOracle, PriceOracleABI, signerOrProvider);
}

// ──────────────────── Read Functions ────────────────────

export async function fetchAllAssetData(provider) {
  const pool = getLendingPool(provider);
  const oracle = getPriceOracle(provider);

  const assets = [];

  for (const cfg of ASSET_CONFIG) {
    const [assetData, priceWad, config] = await Promise.all([
      pool.getAssetData(cfg.address),
      oracle.getAssetPrice(cfg.address),
      pool.assetConfigs(cfg.address),
    ]);

    const decimals = Number(config.decimals);
    const totalSupply = formatTokenAmount(assetData.totalDeposits, decimals);
    const totalBorrow = formatTokenAmount(assetData.totalBorrows, decimals);
    const supplyAPY = wadToFloat(assetData.supplyRate);
    const borrowAPY = wadToFloat(assetData.borrowRate);
    const price = wadToFloat(priceWad);
    const utilization = totalSupply > 0 ? totalBorrow / totalSupply : 0;

    assets.push({
      symbol: cfg.symbol,
      name: cfg.name,
      address: cfg.address,
      decimals,
      price,
      ltv: bpsToFraction(config.ltvBps),
      liquidationThreshold: bpsToFraction(config.liquidationThresholdBps),
      liquidationBonusBps: Number(config.liquidationBonusBps),
      totalSupply,
      totalBorrow,
      supplyAPY,
      borrowAPY,
      utilization,
      userSupplied: 0,
      userBorrowed: 0,
      walletBalance: 0,
    });
  }

  return assets;
}

export async function fetchUserData(signerOrProvider, userAddress) {
  const pool = getLendingPool(signerOrProvider);
  const result = {};

  for (const cfg of ASSET_CONFIG) {
    const erc20 = getERC20(cfg.address, signerOrProvider);
    const [position, balance, allowance] = await Promise.all([
      pool.getUserPosition(userAddress, cfg.address),
      erc20.balanceOf(userAddress),
      erc20.allowance(userAddress, LENDING_POOL_ADDRESS),
    ]);

    // Need decimals from assetConfigs
    const config = await pool.assetConfigs(cfg.address);
    const decimals = Number(config.decimals);

    result[cfg.symbol] = {
      userSupplied: formatTokenAmount(position.deposited, decimals),
      userBorrowed: formatTokenAmount(position.borrowed, decimals),
      walletBalance: formatTokenAmount(balance, decimals),
      allowance: formatTokenAmount(allowance, decimals),
    };
  }

  return result;
}

export async function fetchUserAccountData(signerOrProvider, userAddress) {
  const pool = getLendingPool(signerOrProvider);
  const data = await pool.getUserAccountData(userAddress);

  const hfRaw = data.healthFactor;
  const healthFactor = hfRaw === MAX_UINT256 ? Infinity : wadToFloat(hfRaw);

  return {
    totalCollateralUSD: wadToFloat(data.totalCollateralUSD),
    totalDebtUSD: wadToFloat(data.totalDebtUSD),
    availableBorrowUSD: wadToFloat(data.availableBorrowUSD),
    healthFactor,
  };
}

export async function fetchLiquidatablePositions(provider) {
  const pool = getLendingPool(provider);

  // Query Borrow events to discover borrower addresses
  let borrowEvents;
  try {
    borrowEvents = await pool.queryFilter("Borrow");
  } catch {
    borrowEvents = [];
  }

  // Collect unique borrower addresses
  const borrowerSet = new Set();
  for (const event of borrowEvents) {
    borrowerSet.add(event.args.user);
  }

  // Also check Deposit events for completeness
  let depositEvents;
  try {
    depositEvents = await pool.queryFilter("Deposit");
  } catch {
    depositEvents = [];
  }
  for (const event of depositEvents) {
    borrowerSet.add(event.args.user);
  }

  const positions = [];

  for (const addr of borrowerSet) {
    try {
      const accountData = await pool.getUserAccountData(addr);
      const hfRaw = accountData.healthFactor;
      const healthFactor = hfRaw === MAX_UINT256 ? Infinity : wadToFloat(hfRaw);
      const totalDebtUSD = wadToFloat(accountData.totalDebtUSD);

      // Only include positions that have debt
      if (totalDebtUSD <= 0) continue;

      const collateral = [];
      const debt = [];

      for (const cfg of ASSET_CONFIG) {
        const position = await pool.getUserPosition(addr, cfg.address);
        const config = await pool.assetConfigs(cfg.address);
        const decimals = Number(config.decimals);

        const deposited = formatTokenAmount(position.deposited, decimals);
        const borrowed = formatTokenAmount(position.borrowed, decimals);

        if (deposited > 0) {
          collateral.push({ symbol: cfg.symbol, amount: deposited });
        }
        if (borrowed > 0) {
          debt.push({ symbol: cfg.symbol, amount: borrowed });
        }
      }

      positions.push({
        address: addr,
        collateral,
        debt,
        healthFactor,
      });
    } catch {
      // skip addresses that fail
    }
  }

  // Sort by health factor ascending (most at-risk first)
  positions.sort((a, b) => a.healthFactor - b.healthFactor);
  return positions;
}

// ──────────────────── Write Functions ────────────────────

export async function approveToken(signer, tokenAddress) {
  const erc20 = getERC20(tokenAddress, signer);
  const tx = await erc20.approve(LENDING_POOL_ADDRESS, MAX_UINT256);
  await tx.wait();
  return tx;
}

export async function depositAction(signer, assetAddress, amount, decimals) {
  const pool = getLendingPool(signer);
  const amountWei = ethers.parseUnits(String(amount), decimals);
  const tx = await pool.deposit(assetAddress, amountWei);
  await tx.wait();
  return tx;
}

export async function withdrawAction(signer, assetAddress, amount, decimals) {
  const pool = getLendingPool(signer);
  const amountWei = ethers.parseUnits(String(amount), decimals);
  const tx = await pool.withdraw(assetAddress, amountWei);
  await tx.wait();
  return tx;
}

export async function borrowAction(signer, assetAddress, amount, decimals) {
  const pool = getLendingPool(signer);
  const amountWei = ethers.parseUnits(String(amount), decimals);
  const tx = await pool.borrow(assetAddress, amountWei);
  await tx.wait();
  return tx;
}

export async function repayAction(signer, assetAddress, amount, decimals) {
  const pool = getLendingPool(signer);
  const amountWei = ethers.parseUnits(String(amount), decimals);
  const tx = await pool.repay(assetAddress, amountWei);
  await tx.wait();
  return tx;
}

export async function liquidateAction(
  signer,
  borrowerAddress,
  debtAssetAddress,
  debtAmount,
  debtDecimals,
  collateralAssetAddress
) {
  const pool = getLendingPool(signer);
  const amountWei = ethers.parseUnits(String(debtAmount), debtDecimals);
  const tx = await pool.liquidate(borrowerAddress, debtAssetAddress, amountWei, collateralAssetAddress);
  await tx.wait();
  return tx;
}

export async function faucetAction(signer, tokenAddress, amount, decimals) {
  const erc20 = getERC20(tokenAddress, signer);
  const amountWei = ethers.parseUnits(String(amount), decimals);
  const tx = await erc20.faucet(amountWei);
  await tx.wait();
  return tx;
}

// ──────────────────── Error Parsing ────────────────────

export function parseContractError(error) {
  // MetaMask user rejection — covers both ethers.js wrapper and raw provider errors
  if (
    error?.code === "ACTION_REJECTED" ||
    error?.code === 4001 ||
    error?.info?.error?.code === 4001
  ) {
    return "Transaction rejected by user.";
  }
  if (error?.code === "CALL_EXCEPTION") {
    const reason = error?.reason || error?.revert?.args?.[0] || "Transaction reverted";
    return String(reason);
  }
  if (error?.code === "NETWORK_ERROR" || error?.code === "SERVER_ERROR") {
    return "Cannot connect to network. Is the Hardhat node running?";
  }
  if (error?.code === "INSUFFICIENT_FUNDS") {
    return "Insufficient ETH for gas fees.";
  }
  // Try to extract revert reason from nested error
  const msg = error?.shortMessage || error?.message || "Unknown error";
  // Extract revert reason from messages like 'execution reverted: "LendingPool: zero amount"'
  const match = msg.match(/reverted.*?["'](.+?)["']/);
  if (match) return match[1];
  return msg;
}
