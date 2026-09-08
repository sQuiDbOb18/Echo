import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();
const usdc = (value: string) => ethers.parseUnits(value, 6);
const stock = (value: string) => ethers.parseUnits(value, 18);

async function deployEchoFixture() {
  const [owner, user, executor, stranger] = await ethers.getSigners();
  const musdc = await ethers.deployContract("MockERC20", ["Mock USDC", "mUSDC", 6, owner.address]);
  const maapl = await ethers.deployContract("MockERC20", ["Mock Apple", "mAAPL", 18, owner.address]);
  const mnvda = await ethers.deployContract("MockERC20", ["Mock Nvidia", "mNVDA", 18, owner.address]);
  const pool = await ethers.deployContract("SimpleSwapPool", [musdc, owner.address]);
  const vault = await ethers.deployContract("AgentVault", [musdc, pool, executor.address, owner.address]);

  await musdc.mint(user.address, usdc("1000"));
  await musdc.mint(owner.address, usdc("20000"));
  await maapl.mint(owner.address, stock("100"));
  await mnvda.mint(owner.address, stock("100"));
  await musdc.approve(pool, usdc("20000"));
  await maapl.approve(pool, stock("50"));
  await mnvda.approve(pool, stock("50"));
  await pool.addLiquidity(maapl, usdc("5000"), stock("50"));
  await pool.addLiquidity(mnvda, usdc("5000"), stock("50"));
  await vault.addStockToken(maapl);
  await vault.addStockToken(mnvda);

  return { owner, user, executor, stranger, musdc, maapl, mnvda, pool, vault };
}

describe("Echo contracts", function () {
  it("mints mock assets with the configured decimals", async function () {
    const { owner, musdc, maapl } = await deployEchoFixture();
    await musdc.mint(owner.address, usdc("25"));
    expect(await musdc.balanceOf(owner.address)).to.be.greaterThan(0n);
    expect(await musdc.decimals()).to.equal(6);
    expect(await maapl.decimals()).to.equal(18);
  });

  it("mints proportional shares and returns proportional assets", async function () {
    const { user, musdc, vault } = await deployEchoFixture();
    const amount = usdc("100");
    await musdc.connect(user).approve(vault, amount);
    await vault.connect(user).deposit(amount);
    expect(await vault.shares(user.address)).to.equal(amount);
    expect(await vault.totalShares()).to.equal(amount);
    await vault.connect(user).withdraw(amount);
    expect(await vault.shares(user.address)).to.equal(0n);
    expect(await musdc.balanceOf(user.address)).to.equal(usdc("1000"));
  });

  it("executes a constant-product swap with slippage protection", async function () {
    const { owner, musdc, maapl, pool } = await deployEchoFixture();
    const amountIn = usdc("100");
    await musdc.approve(pool, amountIn);
    const expected = await pool.getAmountOut(musdc, maapl, amountIn);
    await expect(pool.swap(musdc, maapl, amountIn, expected, owner.address))
      .to.emit(pool, "Swapped")
      .withArgs(owner.address, musdc, maapl, amountIn, expected);
    expect(await maapl.balanceOf(owner.address)).to.equal(stock("50") + expected);
  });

  it("only allows the configured executor to trade the vault", async function () {
    const { executor, stranger, musdc, maapl, vault } = await deployEchoFixture();
    await expect(vault.connect(stranger).executeTrade(musdc, musdc, usdc("1"), 0n, "bad"))
      .to.be.revertedWith("vault: only executor");
    await musdc.mint(vault, usdc("100"));
    await expect(vault.connect(executor).executeTrade(musdc, maapl, usdc("1"), 0n, "test trade"))
      .to.emit(vault, "TradeExecuted");
  });
});