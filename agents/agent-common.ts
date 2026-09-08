import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Contract, JsonRpcProvider, Wallet, formatUnits } from "ethers";
import { loadAddresses, privateKey, rpcUrl } from "./config.js";

const poolAbi = [
  "function getPrice(address) view returns (uint256)",
  "function getAmountOut(address,address,uint256) view returns (uint256)",
];
const tokenAbi = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];
const baseTokenAbi = ["function balanceOf(address) view returns (uint256)"];
const vaultAbi = [
  "function executeTrade(address,address,uint256,uint256,string) returns (uint256)",
  "function shares(address) view returns (uint256)",
];

export type Strategy = "momentum" | "contrarian";
export type PollSnapshot = { aapl: number; nvda: number; timestamp: number };

export function createAgent(strategy: Strategy) {
  const addresses = loadAddresses();
  const provider = new JsonRpcProvider(rpcUrl, 84532);
  const wallet = new Wallet(privateKey as string, provider);
  const pool = new Contract(addresses.pool, poolAbi, provider);
  const vaultAddress = strategy === "momentum" ? addresses.momentumVault : addresses.contrarianVault;
  const vault = new Contract(vaultAddress, vaultAbi, wallet);
  const aapl = new Contract(addresses.mAAPL, tokenAbi, provider);
  const nvda = new Contract(addresses.mNVDA, tokenAbi, provider);
  const musdc = new Contract(addresses.mUSDC, baseTokenAbi, provider);

  async function poll(previous?: PollSnapshot): Promise<PollSnapshot> {
    const [aaplPrice, nvdaPrice] = await Promise.all([
      pool.getPrice(addresses.mAAPL),
      pool.getPrice(addresses.mNVDA),
    ]);
    const current = {
      aapl: Number(formatUnits(aaplPrice, 18)),
      nvda: Number(formatUnits(nvdaPrice, 18)),
      timestamp: Date.now(),
    };
    if (previous) {
      const aaplChange = (current.aapl - previous.aapl) / previous.aapl;
      const nvdaChange = (current.nvda - previous.nvda) / previous.nvda;
      const winner = strategy === "momentum"
        ? aaplChange > nvdaChange ? "aapl" : "nvda"
        : aaplChange < nvdaChange ? "aapl" : "nvda";
      const loser = winner === "aapl" ? "nvda" : "aapl";
      const winnerAddress = winner === "aapl" ? addresses.mAAPL : addresses.mNVDA;
      const loserAddress = loser === "aapl" ? addresses.mAAPL : addresses.mNVDA;
      const loserContract = loser === "aapl" ? aapl : nvda;
      const loserBalance = await loserContract.balanceOf(vaultAddress);
      const baseBalance = await musdc.balanceOf(vaultAddress);
      const amountIn = loserBalance > 0n ? (loserBalance * 15n) / 100n : (baseBalance * 15n) / 100n;
      if (amountIn > 0n) {
        const source = loserBalance > 0n ? (loser === "aapl" ? "mAAPL" : "mNVDA") : "mUSDC";
        const reasoning = `Rotated 15% from ${source} to ${winner === "aapl" ? "mAAPL" : "mNVDA"} on relative ${strategy} shift`;
        if (loserBalance > 0n) {
          const baseAmountOut = await pool.getAmountOut(loserAddress, addresses.mUSDC, amountIn);
          const sellTx = await vault.executeTrade(loserAddress, addresses.mUSDC, amountIn, 0n, reasoning);
          await sellTx.wait();
          const buyTx = await vault.executeTrade(addresses.mUSDC, winnerAddress, baseAmountOut, 0n, reasoning);
          await buyTx.wait();
          await logDecision(strategy, { action: "trade", reasoning, txHash: buyTx.hash, timestamp: new Date().toISOString() });
          console.log(`[${strategy}] ${reasoning} (${buyTx.hash})`);
        } else {
          const tx = await vault.executeTrade(addresses.mUSDC, winnerAddress, amountIn, 0n, reasoning);
          await tx.wait();
          await logDecision(strategy, { action: "trade", reasoning, txHash: tx.hash, timestamp: new Date().toISOString() });
          console.log(`[${strategy}] ${reasoning} (${tx.hash})`);
        }
      } else {
        const reasoning = `Skipped: no ${loser === "aapl" ? "mAAPL" : "mNVDA"} balance available to rotate`;
        await logDecision(strategy, { action: "skip", reasoning, timestamp: new Date().toISOString() });
        console.log(`[${strategy}] ${reasoning}`);
      }
    } else {
      await logDecision(strategy, { action: "skip", reasoning: "Initial price snapshot collected", timestamp: new Date().toISOString() });
      console.log(`[${strategy}] Initial price snapshot collected`);
    }
    return current;
  }

  return { poll, wallet, vaultAddress, addresses };
}

async function logDecision(strategy: Strategy, entry: Record<string, unknown>) {
  const path = resolve(process.cwd(), `agents/logs/${strategy}.json`);
  await mkdir(dirname(path), { recursive: true });
  let history: Record<string, unknown>[] = [];
  try {
    const { readFile } = await import("node:fs/promises");
    history = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>[];
  } catch {
    // The first decision creates the log.
  }
  history.push(entry);
  await writeFile(path, `${JSON.stringify(history, null, 2)}\n`);
}