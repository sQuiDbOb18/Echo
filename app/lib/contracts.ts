import type { Address } from "viem";

const address = (value: string | undefined) => (value && value !== "0x0000000000000000000000000000000000000000" ? value as Address : undefined);

export const contracts = {
  musdc: address(process.env.NEXT_PUBLIC_MUSDC_ADDRESS),
  maapl: address(process.env.NEXT_PUBLIC_MAAPL_ADDRESS),
  mnvda: address(process.env.NEXT_PUBLIC_MNVDA_ADDRESS),
  pool: address(process.env.NEXT_PUBLIC_POOL_ADDRESS),
  momentum: address(process.env.NEXT_PUBLIC_MOMENTUM_VAULT_ADDRESS),
  contrarian: address(process.env.NEXT_PUBLIC_CONTRARIAN_VAULT_ADDRESS),
};

export const deploymentBlocks = {
  momentum: BigInt(process.env.NEXT_PUBLIC_MOMENTUM_DEPLOYMENT_BLOCK ?? "0"),
  contrarian: BigInt(process.env.NEXT_PUBLIC_CONTRARIAN_DEPLOYMENT_BLOCK ?? "0"),
};

export const vaultAbi = [
  { type: "function", name: "getNAV", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalShares", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "shares", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "deposit", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "event", name: "TradeExecuted", anonymous: false, inputs: [
    { indexed: true, name: "tokenIn", type: "address" },
    { indexed: true, name: "tokenOut", type: "address" },
    { indexed: false, name: "amountIn", type: "uint256" },
    { indexed: false, name: "amountOut", type: "uint256" },
    { indexed: false, name: "reasoning", type: "string" },
    { indexed: false, name: "timestamp", type: "uint256" },
  ] },
] as const;

export const erc20Abi = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;