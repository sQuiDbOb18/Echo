import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const USDC = 1_000_000n;
const STOCK = 10n ** 18n;

export default buildModule("EchoDemoModule", (m) => {
  const deployer = m.getAccount(0);
  const musdc = m.contract("MockERC20", ["Mock USDC", "mUSDC", 6, deployer], { id: "MockUSDC" });
  const maapl = m.contract("MockERC20", ["Mock Apple", "mAAPL", 18, deployer], { id: "MockAAPL" });
  const mnvda = m.contract("MockERC20", ["Mock Nvidia", "mNVDA", 18, deployer], { id: "MockNVDA" });
  const pool = m.contract("SimpleSwapPool", [musdc, deployer]);
  const momentum = m.contract("AgentVault", [musdc, pool, deployer, deployer], { id: "MomentumVault" });
  const contrarian = m.contract("AgentVault", [musdc, pool, deployer, deployer], { id: "ContrarianVault" });

  m.call(musdc, "mint", [deployer, 1_000_000n * USDC], { id: "MintUSDC" });
  m.call(maapl, "mint", [deployer, 10_000n * STOCK], { id: "MintAAPL" });
  m.call(mnvda, "mint", [deployer, 10_000n * STOCK], { id: "MintNVDA" });
  m.call(musdc, "approve", [pool, 500_000n * USDC], { id: "ApprovePoolUSDC" });
  m.call(maapl, "approve", [pool, 5_000n * STOCK], { id: "ApprovePoolAAPL" });
  m.call(mnvda, "approve", [pool, 5_000n * STOCK], { id: "ApprovePoolNVDA" });
  m.call(pool, "addLiquidity", [maapl, 250_000n * USDC, 5_000n * STOCK], { id: "SeedAAPL" });
  m.call(pool, "addLiquidity", [mnvda, 250_000n * USDC, 5_000n * STOCK], { id: "SeedNVDA" });
  m.call(momentum, "addStockToken", [maapl], { id: "MomentumAAPL" });
  m.call(momentum, "addStockToken", [mnvda], { id: "MomentumNVDA" });
  m.call(contrarian, "addStockToken", [maapl], { id: "ContrarianAAPL" });
  m.call(contrarian, "addStockToken", [mnvda], { id: "ContrarianNVDA" });

  return { musdc, maapl, mnvda, pool, momentum, contrarian };
});