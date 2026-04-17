import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ASSET_CONFIG,
  getReadProvider,
  connectWallet as connectWalletService,
  fetchAllAssetData,
  fetchUserData,
  fetchUserAccountData,
  fetchLiquidatablePositions,
  approveToken,
  depositAction,
  withdrawAction,
  borrowAction,
  repayAction,
  liquidateAction,
  faucetAction,
  parseContractError,
} from "../services/contractService";

let txIdCounter = 0;

export default function useLending() {
  // ──────────────────── State ────────────────────

  const [assets, setAssets] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [allowances, setAllowances] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [accountData, setAccountData] = useState({
    totalCollateralUSD: 0,
    totalDebtUSD: 0,
    availableBorrowUSD: 0,
    healthFactor: Infinity,
  });
  const [liquidatablePositions, setLiquidatablePositions] = useState([]);

  const signerRef = useRef(null);
  const providerRef = useRef(null);

  // ──────────────────── Toast Management ────────────────────

  const addToast = useCallback((message, type = "success") => {
    const id = ++txIdCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ──────────────────── Data Fetching ────────────────────

  const refreshData = useCallback(async () => {
    try {
      const provider = providerRef.current || getReadProvider();
      const marketAssets = await fetchAllAssetData(provider);

      if (signerRef.current && walletAddress) {
        const userData = await fetchUserData(
          signerRef.current,
          walletAddress
        );
        const acctData = await fetchUserAccountData(
          signerRef.current,
          walletAddress
        );

        // Merge user data into assets
        const mergedAssets = marketAssets.map((asset) => {
          const user = userData[asset.symbol];
          if (user) {
            return {
              ...asset,
              userSupplied: user.userSupplied,
              userBorrowed: user.userBorrowed,
              walletBalance: user.walletBalance,
            };
          }
          return asset;
        });

        // Extract allowances
        const newAllowances = {};
        for (const cfg of ASSET_CONFIG) {
          const user = userData[cfg.symbol];
          if (user) {
            newAllowances[cfg.symbol] = user.allowance;
          }
        }

        setAssets(mergedAssets);
        setAllowances(newAllowances);
        setAccountData(acctData);
      } else {
        setAssets(marketAssets);
        setAccountData({
          totalCollateralUSD: 0,
          totalDebtUSD: 0,
          availableBorrowUSD: 0,
          healthFactor: Infinity,
        });
        setAllowances({});
      }

      // Fetch liquidatable positions
      try {
        const positions = await fetchLiquidatablePositions(provider);
        setLiquidatablePositions(positions);
      } catch {
        // Non-critical — don't block main data
      }
    } catch (err) {
      console.error("Failed to refresh data:", err);
    }
  }, [walletAddress]);

  // ──────────────────── Init: load market data on mount ────────────────────

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        providerRef.current = getReadProvider();
        await refreshData();
      } catch (err) {
        console.error("Failed to load initial data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ──────────────────── Enriched Assets ────────────────────

  const enrichedAssets = useMemo(() => {
    return assets.map((asset) => {
      // Rates are already from the contract; recalc utilization for safety
      const utilization =
        asset.totalSupply > 0 ? asset.totalBorrow / asset.totalSupply : 0;
      return {
        ...asset,
        utilization,
        supplyAPY: asset.supplyAPY,
        borrowAPY: asset.borrowAPY,
      };
    });
  }, [assets]);

  // ──────────────────── Computed Values ────────────────────

  const {
    totalCollateralUSD,
    totalDebtUSD,
    healthFactor,
    netAPY,
    borrowLimitUSD,
    borrowLimitUsed,
  } = useMemo(() => {
    // Use on-chain accountData for HF, collateral, debt
    const hf = accountData.healthFactor;
    const collUSD = accountData.totalCollateralUSD;
    const debtUSD = accountData.totalDebtUSD;

    // borrowLimitUSD = sum(depositUSD * ltv) for each asset
    let borrowPower = 0;
    let weightedSupplyAPY = 0;
    let weightedBorrowAPY = 0;
    let totalSuppliedUSD = 0;
    let totalBorrowedUSD = 0;

    for (const asset of enrichedAssets) {
      const suppliedUSD = asset.userSupplied * asset.price;
      const borrowedUSD = asset.userBorrowed * asset.price;

      borrowPower += suppliedUSD * asset.ltv;
      totalSuppliedUSD += suppliedUSD;
      totalBorrowedUSD += borrowedUSD;
      weightedSupplyAPY += suppliedUSD * asset.supplyAPY;
      weightedBorrowAPY += borrowedUSD * asset.borrowAPY;
    }

    const supplyAPYAvg =
      totalSuppliedUSD > 0 ? weightedSupplyAPY / totalSuppliedUSD : 0;
    const borrowAPYAvg =
      totalBorrowedUSD > 0 ? weightedBorrowAPY / totalBorrowedUSD : 0;

    return {
      totalCollateralUSD: collUSD,
      totalDebtUSD: debtUSD,
      healthFactor: hf,
      netAPY: supplyAPYAvg - borrowAPYAvg,
      borrowLimitUSD: borrowPower,
      borrowLimitUsed: borrowPower > 0 ? debtUSD / borrowPower : 0,
    };
  }, [enrichedAssets, accountData]);

  // Protocol stats computed from on-chain data
  const protocolStats = useMemo(() => {
    let tvl = 0;
    for (const asset of enrichedAssets) {
      tvl += asset.totalSupply * asset.price;
    }
    return { tvl, totalMarketSize: tvl };
  }, [enrichedAssets]);

  // ──────────────────── HF Simulation (client-side) ────────────────────

  const simulateHealthFactor = useCallback(
    (action, symbol, amount) => {
      const num = parseFloat(amount);
      if (!num || num <= 0) return healthFactor;

      let simCollateral = 0;
      let simDebt = 0;

      for (const asset of enrichedAssets) {
        let supplied = asset.userSupplied;
        let borrowed = asset.userBorrowed;

        if (asset.symbol === symbol) {
          if (action === "deposit") supplied += num;
          if (action === "withdraw") supplied = Math.max(0, supplied - num);
          if (action === "borrow") borrowed += num;
          if (action === "repay") borrowed = Math.max(0, borrowed - num);
        }

        simCollateral += supplied * asset.price * asset.liquidationThreshold;
        simDebt += borrowed * asset.price;
      }

      return simDebt > 0 ? simCollateral / simDebt : Infinity;
    },
    [enrichedAssets, healthFactor]
  );

  // Calculate max borrow - only limited by pool liquidity, not by LTV/collateral
  // This allows users to borrow into liquidation territory
  const calculateMaxBorrow = useCallback(
    (symbol) => {
      const asset = enrichedAssets.find((a) => a.symbol === symbol);
      if (!asset) return 0;
      const availableLiquidity = asset.totalSupply - asset.totalBorrow;
      return Math.max(0, availableLiquidity);
    },
    [enrichedAssets]
  );

  // ──────────────────── Transaction Logging ────────────────────

  const addTransaction = useCallback(
    (type, symbol, amount) => {
      const record = {
        id: ++txIdCounter,
        type,
        symbol,
        amount: parseFloat(amount),
        timestamp: Date.now(),
        hfBefore: healthFactor,
        hfAfter: null,
      };
      setTransactions((prev) => [record, ...prev].slice(0, 20));
    },
    [healthFactor]
  );

  // ──────────────────── Wallet Connection ────────────────────

  const connectWallet = useCallback(async () => {
    try {
      const { signer, address } = await connectWalletService();
      signerRef.current = signer;
      setIsConnected(true);
      setWalletAddress(address);

      // Listen for account changes
      if (window.ethereum) {
        window.ethereum.on("accountsChanged", (accounts) => {
          if (accounts.length === 0) {
            signerRef.current = null;
            setIsConnected(false);
            setWalletAddress("");
          } else {
            // Re-connect with new account
            connectWalletService().then(({ signer: newSigner, address: newAddr }) => {
              signerRef.current = newSigner;
              setWalletAddress(newAddr);
            });
          }
        });

        window.ethereum.on("chainChanged", () => {
          window.location.reload();
        });
      }
    } catch (err) {
      addToast(parseContractError(err), "error");
      throw err;
    }
  }, [addToast]);

  // Refresh data when wallet address changes
  useEffect(() => {
    if (walletAddress) {
      refreshData();
    }
  }, [walletAddress, refreshData]);

  const disconnectWallet = useCallback(() => {
    signerRef.current = null;
    setIsConnected(false);
    setWalletAddress("");
    setAllowances({});
    setAccountData({
      totalCollateralUSD: 0,
      totalDebtUSD: 0,
      availableBorrowUSD: 0,
      healthFactor: Infinity,
    });
    // Reset user fields in assets
    setAssets((prev) =>
      prev.map((a) => ({
        ...a,
        userSupplied: 0,
        userBorrowed: 0,
        walletBalance: 0,
      }))
    );
  }, []);

  // ──────────────────── Helper: find asset by symbol ────────────────────

  const findAsset = useCallback(
    (symbol) => {
      return enrichedAssets.find((a) => a.symbol === symbol);
    },
    [enrichedAssets]
  );

  // ──────────────────── Core Actions ────────────────────

  const approve = useCallback(
    async (symbol) => {
      if (!signerRef.current) throw new Error("Wallet not connected");
      const asset = findAsset(symbol);
      if (!asset) throw new Error(`Asset ${symbol} not found`);

      try {
        await approveToken(signerRef.current, asset.address);
        addToast(`Approved ${symbol} for LendingPool`);
        await refreshData();
      } catch (err) {
        const msg = parseContractError(err);
        addToast(msg, "error");
        throw err;
      }
    },
    [findAsset, addToast, refreshData]
  );

  const deposit = useCallback(
    async (symbol, amount) => {
      if (!signerRef.current) throw new Error("Wallet not connected");
      const asset = findAsset(symbol);
      if (!asset) throw new Error(`Asset ${symbol} not found`);

      try {
        await depositAction(signerRef.current, asset.address, amount, asset.decimals);
        addTransaction("deposit", symbol, amount);
        addToast(`Deposited ${amount} ${symbol}`);
        await refreshData();
      } catch (err) {
        const msg = parseContractError(err);
        addToast(msg, "error");
        throw err;
      }
    },
    [findAsset, addTransaction, addToast, refreshData]
  );

  const withdraw = useCallback(
    async (symbol, amount) => {
      if (!signerRef.current) throw new Error("Wallet not connected");
      const asset = findAsset(symbol);
      if (!asset) throw new Error(`Asset ${symbol} not found`);

      try {
        await withdrawAction(signerRef.current, asset.address, amount, asset.decimals);
        addTransaction("withdraw", symbol, amount);
        addToast(`Withdrew ${amount} ${symbol}`);
        await refreshData();
      } catch (err) {
        const msg = parseContractError(err);
        addToast(msg, "error");
        throw err;
      }
    },
    [findAsset, addTransaction, addToast, refreshData]
  );

  const borrow = useCallback(
    async (symbol, amount) => {
      if (!signerRef.current) throw new Error("Wallet not connected");
      const asset = findAsset(symbol);
      if (!asset) throw new Error(`Asset ${symbol} not found`);

      try {
        await borrowAction(signerRef.current, asset.address, amount, asset.decimals);
        addTransaction("borrow", symbol, amount);
        addToast(`Borrowed ${amount} ${symbol}`);
        await refreshData();
      } catch (err) {
        const msg = parseContractError(err);
        addToast(msg, "error");
        throw err;
      }
    },
    [findAsset, addTransaction, addToast, refreshData]
  );

  const repay = useCallback(
    async (symbol, amount) => {
      if (!signerRef.current) throw new Error("Wallet not connected");
      const asset = findAsset(symbol);
      if (!asset) throw new Error(`Asset ${symbol} not found`);

      try {
        await repayAction(signerRef.current, asset.address, amount, asset.decimals);
        addTransaction("repay", symbol, amount);
        addToast(`Repaid ${amount} ${symbol}`);
        await refreshData();
      } catch (err) {
        const msg = parseContractError(err);
        addToast(msg, "error");
        throw err;
      }
    },
    [findAsset, addTransaction, addToast, refreshData]
  );

  const liquidate = useCallback(
    async (borrowerAddress, debtSymbol, amount, collateralSymbol) => {
      if (!signerRef.current) throw new Error("Wallet not connected");
      const debtAsset = findAsset(debtSymbol);
      const colAsset = findAsset(collateralSymbol);
      if (!debtAsset || !colAsset) throw new Error("Asset not found");

      try {
        await liquidateAction(
          signerRef.current,
          borrowerAddress,
          debtAsset.address,
          amount,
          debtAsset.decimals,
          colAsset.address
        );
        addTransaction("liquidate", debtSymbol, amount);
        addToast(`Liquidated ${amount} ${debtSymbol} debt`);
        await refreshData();
      } catch (err) {
        const msg = parseContractError(err);
        addToast(msg, "error");
        throw err;
      }
    },
    [findAsset, addTransaction, addToast, refreshData]
  );

  const faucet = useCallback(
    async (symbol, amount) => {
      if (!signerRef.current) throw new Error("Wallet not connected");
      const asset = findAsset(symbol);
      if (!asset) throw new Error(`Asset ${symbol} not found`);

      try {
        await faucetAction(signerRef.current, asset.address, amount, asset.decimals);
        addToast(`Minted ${amount} ${symbol} to your wallet`);
        await refreshData();
      } catch (err) {
        const msg = parseContractError(err);
        addToast(msg, "error");
        throw err;
      }
    },
    [findAsset, addToast, refreshData]
  );

  // ──────────────────── Return ────────────────────

  return {
    assets: enrichedAssets,
    isConnected,
    walletAddress,
    healthFactor,
    totalCollateralUSD,
    totalDebtUSD,
    netAPY,
    borrowLimitUSD,
    borrowLimitUsed,
    protocolStats,
    transactions,
    toasts,
    liquidatablePositions,
    isLoading,
    allowances,
    simulateHealthFactor,
    calculateMaxBorrow,
    connectWallet,
    disconnectWallet,
    deposit,
    withdraw,
    borrow,
    repay,
    liquidate,
    approve,
    faucet,
    refreshData,
    addToast,
    removeToast,
  };
}
