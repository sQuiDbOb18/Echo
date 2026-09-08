# Echo

Echo turns Base's tokenized-stock and agentic-trading direction into a transparent, playable demo: deposit mock USDC behind an AI trading persona and watch its portfolio rotate through mock AAPL and NVDA. Every decision is executed on Base Sepolia and explained onchain in plain language, so the strategy is inspectable rather than a black box.

What makes Echo stand out is the tight loop between agent behavior, portfolio-backed ownership, and an auditable rationale feed. It is a small prototype of the trust layer an agentic market needs before ideas like portfolio-backed credit can become usable.

## Architecture

- `contracts/`: MockERC20 assets, a minimal constant-product swap pool, and share-accounting agent vaults.
- `ignition/modules/Echo.ts`: Deploys mUSDC, mAAPL, mNVDA, both vaults, pool liquidity, and test supply.
- `agents/`: Ethers-based Momentum and Contrarian loops. Each polls pool prices, executes trades, and writes local JSON decisions.
- `app/`: Next.js 14 dashboard with RainbowKit/wagmi wallet connection, NAV reads, deposit flow, and live TradeExecuted feed.

## Tech Stack

Solidity 0.8.34, OpenZeppelin ERC20, Hardhat 3, Ignition, ethers.js, TypeScript, Mocha, Next.js 14 App Router, Tailwind CSS, wagmi, RainbowKit, and Recharts.

## Setup

From the repository root:

```bash
npm install
cd app && npm install && cd ..
```

Create a root `.env` (never commit it):

```dotenv
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/your_key
PRIVATE_KEY=your_agent_executor_private_key
```

For the frontend, copy `app/.env.local.example` to `app/.env.local` and set the deployed addresses, deployment blocks, and `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL`.

## Commands

```bash
npm run build
npm test
npm run deploy:base-sepolia
npm run agent:momentum
npm run agent:contrarian
cd app && npm run dev -- --hostname 0.0.0.0 --port 3000
```

Run the two agent commands in separate terminals. The frontend is available at `http://localhost:3000`.

## Base Sepolia Deployment

| Contract | Address |
| --- | --- |
| Mock mUSDC | `0x1a60DdaE583CF45036353E39b4A54F9479B171C4` |
| Mock mAAPL | `0x497B43FDe8439aE433FF469b27Ac62F26038CBAd` |
| Mock mNVDA | `0x331DF0BBc8e3a8797C025e1164907A45ea706248` |
| SimpleSwapPool | `0x8a0D69949c5C74c3add851FF13D4f79a1aa3617F` |
| MomentumVault | `0xc6C798Fe3b8aac98cd3E36acD677b8f68d0262F9` |
| ContrarianVault | `0x858939B658f2932e851A846b6cDC7fC85b2F3Cb1` |

The vault deployment blocks are `46555904` (Momentum) and `46555902` (Contrarian). The dashboard chunks recent event history into ten-block requests to work with free RPC limits.

## How The Agents Work

Momentum compares the latest AAPL and NVDA pool prices with the previous poll and rotates 15% toward the relatively stronger stock. Contrarian uses the inverse signal and rotates toward the stock that just underperformed. When a vault starts with USDC only, the first decision makes an initial USDC-to-stock allocation; later stock rotations route through USDC because the demo pool exposes stock/USDC pairs.

## Demo

Loom recording: `[add Loom link here]`

Echo runs entirely on Base Sepolia with mock assets and testnet ETH. It uses no real funds and is not intended for production trading.

## Testnet Demo Flow

1. Connect a wallet on Base Sepolia.
2. Click **Mint test mUSDC** to mint 1,000 mock USDC.
3. Select an agent, enter an amount, and deposit.
4. Run both agent loops. Their first allocation trades USDC into the selected stock, then later polls rotate 15% between stocks.
5. Watch NAV and the rationale-bearing trade feed update.
