const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  // 1. Deploy MockERC20 tokens
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");

  const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
  await usdc.waitForDeployment();
  console.log("MockUSDC deployed to:", await usdc.getAddress());

  const weth = await MockERC20.deploy("Wrapped Ether", "WETH", 18);
  await weth.waitForDeployment();
  console.log("MockWETH deployed to:", await weth.getAddress());

  // 2. Deploy PriceOracle
  const PriceOracle = await hre.ethers.getContractFactory("PriceOracle");
  const oracle = await PriceOracle.deploy(deployer.address);
  await oracle.waitForDeployment();
  console.log("PriceOracle deployed to:", await oracle.getAddress());

  // Set prices: USDC = $1, WETH = $2450
  await oracle.setAssetPrice(await usdc.getAddress(), hre.ethers.parseEther("1"));
  await oracle.setAssetPrice(await weth.getAddress(), hre.ethers.parseEther("2450"));
  console.log("Prices set: USDC=$1, WETH=$2450");

  // 3. Deploy InterestRateModel
  const InterestRateModel = await hre.ethers.getContractFactory("InterestRateModel");
  const rateModel = await InterestRateModel.deploy();
  await rateModel.waitForDeployment();
  console.log("InterestRateModel deployed to:", await rateModel.getAddress());

  // 4. Deploy LendingPool
  const LendingPool = await hre.ethers.getContractFactory("LendingPool");
  const pool = await LendingPool.deploy(
    await oracle.getAddress(),
    await rateModel.getAddress(),
    deployer.address
  );
  await pool.waitForDeployment();
  console.log("LendingPool deployed to:", await pool.getAddress());

  // 5. Configure assets
  // USDC: decimals=6, LTV=80%, threshold=85%, bonus=5%
  await pool.addAsset(await usdc.getAddress(), 6, 8000, 8500, 500);
  // WETH: decimals=18, LTV=75%, threshold=82%, bonus=10%
  await pool.addAsset(await weth.getAddress(), 18, 7500, 8200, 1000);
  console.log("Assets configured: USDC and WETH");

  // 6. Mint test tokens to deployer
  const usdcAmount = hre.ethers.parseUnits("1000000", 6); // 1M USDC
  const wethAmount = hre.ethers.parseEther("1000");        // 1000 WETH
  await usdc.mint(deployer.address, usdcAmount);
  await weth.mint(deployer.address, wethAmount);
  console.log("Minted 1,000,000 USDC and 1,000 WETH to deployer");

  // 7. Approve LendingPool to spend tokens
  await usdc.approve(await pool.getAddress(), hre.ethers.MaxUint256);
  await weth.approve(await pool.getAddress(), hre.ethers.MaxUint256);
  console.log("Approved LendingPool to spend deployer tokens");

  // 8. Write addresses to JSON for frontend consumption
  const addresses = {
    MockUSDC: await usdc.getAddress(),
    MockWETH: await weth.getAddress(),
    PriceOracle: await oracle.getAddress(),
    InterestRateModel: await rateModel.getAddress(),
    LendingPool: await pool.getAddress(),
    deployer: deployer.address,
    network: hre.network.name,
  };

  const contractsDir = path.join(__dirname, "..", "src", "contracts");
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(contractsDir, "addresses.json"),
    JSON.stringify(addresses, null, 2)
  );
  console.log("Addresses written to src/contracts/addresses.json");

  // 9. Copy ABIs for frontend
  const abisDir = path.join(contractsDir, "abis");
  if (!fs.existsSync(abisDir)) {
    fs.mkdirSync(abisDir, { recursive: true });
  }

  const artifactNames = ["LendingPool", "MockERC20", "PriceOracle", "InterestRateModel"];
  for (const name of artifactNames) {
    const artifact = await hre.artifacts.readArtifact(name);
    fs.writeFileSync(
      path.join(abisDir, `${name}.json`),
      JSON.stringify(artifact.abi, null, 2)
    );
  }
  console.log("ABIs copied to src/contracts/abis/");

  console.log("\n--- Deployment Summary ---");
  console.log(JSON.stringify(addresses, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
