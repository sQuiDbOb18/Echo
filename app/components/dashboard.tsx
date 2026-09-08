"use client";

import { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatUnits, parseUnits, type Address } from "viem";
import { useAccount, usePublicClient, useReadContract, useWalletClient } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { contracts, deploymentBlocks, erc20Abi, vaultAbi } from "../lib/contracts";

type AgentKey = "momentum" | "contrarian";
type Trade = { agent: string; reasoning: string; timestamp: number; hash: string };

const agents = {
  momentum: { name: "Momentum", accent: "#d7ff65", description: "Follows relative strength and leans into the leader." },
  contrarian: { name: "Contrarian", accent: "#73d9ff", description: "Rotates toward the stock the crowd just left behind." },
};

function navLabel(value: bigint | undefined) {
  return value === undefined ? "--" : `$${Number(formatUnits(value, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function AgentCard({ agent, nav, trades }: { agent: AgentKey; nav?: bigint; trades: Trade[] }) {
  const points = [{ value: 100 }, ...trades.slice(-7).map((_, index) => ({ value: 100 + (index + 1) * 1.8 }))];
  return <article className="relative overflow-hidden rounded-[2px] border border-white/10 bg-[#11161d] p-6 shadow-2xl shadow-black/20">
    <div className="absolute right-0 top-0 h-28 w-28 opacity-20" style={{ background: `radial-gradient(circle, ${agents[agent].accent}, transparent 68%)` }} />
    <div className="relative flex items-start justify-between gap-4">
      <div><p className="font-sans text-[11px] uppercase tracking-[0.25em] text-white/40">Agent / 0{agent === "momentum" ? 1 : 2}</p><h2 className="mt-3 text-3xl">{agents[agent].name}</h2><p className="mt-2 max-w-[250px] font-sans text-sm leading-6 text-white/55">{agents[agent].description}</p></div>
      <span className="mt-1 h-3 w-3 rounded-full" style={{ backgroundColor: agents[agent].accent, boxShadow: `0 0 18px ${agents[agent].accent}` }} />
    </div>
    <div className="relative mt-8 grid grid-cols-2 items-end gap-4"><div><p className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/35">Current NAV</p><p className="mt-1 text-2xl">{navLabel(nav)}</p></div><div className="h-16"><ResponsiveContainer width="100%" height="100%"><AreaChart data={points}><defs><linearGradient id={`${agent}Fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={agents[agent].accent} stopOpacity={0.35} /><stop offset="100%" stopColor={agents[agent].accent} stopOpacity={0} /></linearGradient></defs><Area type="monotone" dataKey="value" stroke={agents[agent].accent} fill={`url(#${agent}Fill)`} strokeWidth={2} /></AreaChart></ResponsiveContainer></div></div>
  </article>;
}

function readStatus(error: Error | null | undefined) {
  return error ? "connection issue, retrying..." : undefined;
}

export function Dashboard() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: baseSepolia.id });
  const [selectedAgent, setSelectedAgent] = useState<AgentKey>("momentum");
  const [amount, setAmount] = useState("");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [depositState, setDepositState] = useState("");
  const [mintState, setMintState] = useState("");
  const [feedState, setFeedState] = useState<"loading" | "ready" | "retrying" | "error">("loading");
  const [mounted, setMounted] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  useEffect(() => setMounted(true), []);
  const ready = Boolean(contracts.momentum && contracts.contrarian && contracts.musdc);
  const liveReadOptions = { refetchInterval: 15_000, refetchOnWindowFocus: true, enabled: true };
  const momentumNav = useReadContract({ address: contracts.momentum, abi: vaultAbi, functionName: "getNAV", chainId: baseSepolia.id, query: { ...liveReadOptions, enabled: Boolean(contracts.momentum) } });
  const contrarianNav = useReadContract({ address: contracts.contrarian, abi: vaultAbi, functionName: "getNAV", chainId: baseSepolia.id, query: { ...liveReadOptions, enabled: Boolean(contracts.contrarian) } });
  const selectedVault = contracts[selectedAgent];
  const userShares = useReadContract({ address: selectedVault, abi: vaultAbi, functionName: "shares", args: address ? [address] : undefined, chainId: baseSepolia.id, query: { ...liveReadOptions, enabled: Boolean(selectedVault && address) } });

  useEffect(() => {
    if (!publicClient || !contracts.momentum || !contracts.contrarian) return;
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const loadTrades = async (attempt = 0) => {
      try {
        const latestBlock = await publicClient.getBlockNumber();
        const logs = await Promise.all(["momentum", "contrarian"].map(async (agent) => {
          const key = agent as AgentKey;
          const recentStart = latestBlock > 89n ? latestBlock - 89n : 0n;
          const fromBlock = deploymentBlocks[key] > recentStart ? deploymentBlocks[key] : recentStart;
          const windows = [];
          for (let windowStart = fromBlock; windowStart <= latestBlock; windowStart += 10n) {
            const windowEnd = windowStart + 9n > latestBlock ? latestBlock : windowStart + 9n;
            windows.push(publicClient.getLogs({ address: contracts[key] as Address, event: vaultAbi[4], fromBlock: windowStart, toBlock: windowEnd }));
          }
          return (await Promise.all(windows)).flat();
        }));
        const next = logs.flat().map((log) => ({ agent: log.address.toLowerCase() === contracts.momentum?.toLowerCase() ? "Momentum" : "Contrarian", reasoning: String((log as any).args.reasoning), timestamp: Number((log as any).args.timestamp), hash: log.transactionHash })).sort((a, b) => b.timestamp - a.timestamp);
        if (active) {
          setTrades(next);
          setFeedState("ready");
        }
      } catch {
        if (!active) return;
        if (attempt < 3) {
          setFeedState("retrying");
          retryTimer = setTimeout(() => void loadTrades(attempt + 1), Math.min(1000 * 2 ** attempt, 8000));
        } else {
          setFeedState("error");
        }
      }
    };
    void loadTrades();
    const timer = setInterval(loadTrades, 15_000);
    return () => { active = false; clearInterval(timer); if (retryTimer) clearTimeout(retryTimer); };
  }, [publicClient, refreshNonce]);

  async function refreshAfterTransaction() {
    await Promise.all([momentumNav.refetch(), contrarianNav.refetch(), userShares.refetch()]);
    setRefreshNonce((value) => value + 1);
  }

  async function deposit() {
    if (!walletClient || !publicClient || !address || !contracts.musdc || !selectedVault || !amount) return;
    try {
      setDepositState("Approving mUSDC...");
      const value = parseUnits(amount, 6);
      const approval = await walletClient.writeContract({ address: contracts.musdc, abi: erc20Abi, functionName: "approve", args: [selectedVault, value] });
      await publicClient.waitForTransactionReceipt({ hash: approval });
      setDepositState("Depositing...");
      const depositTx = await walletClient.writeContract({ address: selectedVault, abi: vaultAbi, functionName: "deposit", args: [value] });
      await publicClient.waitForTransactionReceipt({ hash: depositTx });
      setDepositState("Deposit confirmed");
      setAmount("");
      await refreshAfterTransaction();
    } catch (error) { setDepositState(error instanceof Error ? error.message.slice(0, 80) : "Transaction failed"); }
  }

  async function mintTestUsdc() {
    if (!walletClient || !publicClient || !address || !contracts.musdc) return;
    try {
      setMintState("Minting...");
      const hash = await walletClient.writeContract({ address: contracts.musdc, abi: erc20Abi, functionName: "mint", args: [address, parseUnits("1000", 6)] });
      await publicClient.waitForTransactionReceipt({ hash });
      setMintState("1,000 mUSDC minted");
      await refreshAfterTransaction();
    } catch (error) {
      setMintState(error instanceof Error ? error.message.slice(0, 80) : "Mint failed");
    }
  }

  return <main className="min-h-screen bg-[#080b10] selection:bg-[#d7ff65] selection:text-black">
    <nav className="mx-auto flex max-w-7xl items-center justify-between border-b border-white/10 px-6 py-5 lg:px-10"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full border border-[#d7ff65]/70 text-sm text-[#d7ff65]">e</span><span className="font-sans text-sm font-semibold tracking-[0.22em]">ECHO</span></div><div className="flex items-center gap-5"><span className="hidden font-sans text-xs text-white/35 sm:inline">BASE SEPOLIA / MOCK MARKETS</span>{mounted ? <ConnectButton showBalance={false} /> : <span className="h-10 w-32 rounded-md border border-white/10 bg-white/5" />}</div></nav>
    <div className="mx-auto max-w-7xl px-6 pb-16 pt-12 lg:px-10 lg:pt-20"><header className="max-w-3xl"><p className="font-sans text-xs uppercase tracking-[0.28em] text-[#d7ff65]">Signal, made visible</p><h1 className="mt-5 text-5xl leading-[0.95] tracking-tight sm:text-7xl">Let the strategy<br /><em className="text-white/45">speak for itself.</em></h1><p className="mt-7 max-w-xl font-sans text-sm leading-7 text-white/50">Two autonomous paper portfolios. Every rotation is public, priced by mock liquidity, and explained in plain language.</p></header>
      {!ready && <div className="mt-10 border border-[#d7ff65]/30 bg-[#d7ff65]/5 px-5 py-4 font-sans text-sm text-[#d7ff65]">Add the Base Sepolia contract addresses to <code>app/.env.local</code> to activate live data.</div>}
      <section className="mt-14 grid gap-5 md:grid-cols-2"><div><AgentCard agent="momentum" nav={momentumNav.data} trades={trades.filter((trade) => trade.agent === "Momentum")} />{readStatus(momentumNav.error) && <p className="mt-2 font-sans text-xs text-white/40">{readStatus(momentumNav.error)}</p>}</div><div><AgentCard agent="contrarian" nav={contrarianNav.data} trades={trades.filter((trade) => trade.agent === "Contrarian")} />{readStatus(contrarianNav.error) && <p className="mt-2 font-sans text-xs text-white/40">{readStatus(contrarianNav.error)}</p>}</div></section>
      <section className="mt-20 grid gap-12 lg:grid-cols-[1fr_360px]"><div><div className="flex items-end justify-between border-b border-white/10 pb-4"><div><p className="font-sans text-[10px] uppercase tracking-[0.25em] text-white/35">Onchain record</p><h2 className="mt-2 text-3xl">Trade feed</h2></div><span className="font-sans text-xs text-white/35">{feedState === "retrying" ? "connection issue, retrying..." : feedState === "error" ? "connection issue" : "refreshes every 15s"}</span></div><div className="divide-y divide-white/10">{trades.length === 0 ? <p className="py-10 font-sans text-sm text-white/35">{feedState === "error" ? "Trade feed temporarily unavailable. Retrying shortly." : "No trades indexed yet."}</p> : trades.slice(0, 10).map((trade) => <div key={trade.hash} className="flex gap-4 py-5"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#d7ff65]" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-3 font-sans text-xs uppercase tracking-[0.16em] text-white/40"><span>{trade.agent}</span><span>{new Date(trade.timestamp * 1000).toLocaleTimeString()}</span></div><p className="mt-2 text-lg text-white/80">{trade.reasoning}</p></div></div>)}</div></div>
        <aside className="h-fit border border-white/10 bg-[#11161d] p-6"><p className="font-sans text-[10px] uppercase tracking-[0.25em] text-white/35">Allocate capital</p><h2 className="mt-3 text-3xl">Back an agent</h2><button disabled={!mounted || !isConnected || !ready} onClick={mintTestUsdc} className="mt-6 w-full border border-[#d7ff65]/60 px-4 py-3 font-sans text-xs font-bold uppercase tracking-[0.15em] text-[#d7ff65] disabled:cursor-not-allowed disabled:opacity-30">Mint test mUSDC</button><p className="mt-2 min-h-5 font-sans text-xs text-white/40">{mounted ? mintState : ""}</p><div className="mt-4 grid grid-cols-2 gap-2">{(Object.keys(agents) as AgentKey[]).map((agent) => <button key={agent} onClick={() => setSelectedAgent(agent)} className={`border px-3 py-3 text-left font-sans text-xs uppercase tracking-[0.12em] ${selectedAgent === agent ? "border-[#d7ff65] text-[#d7ff65]" : "border-white/10 text-white/45"}`}>{agents[agent].name}</button>)}</div><label className="mt-6 block font-sans text-xs text-white/45">mUSDC amount<input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" type="number" min="0" className="mt-2 w-full border-b border-white/20 bg-transparent px-0 py-3 text-2xl outline-none focus:border-[#d7ff65]" /></label><button disabled={!mounted || !isConnected || !amount || !ready} onClick={deposit} className="mt-6 w-full bg-[#d7ff65] px-4 py-4 font-sans text-xs font-bold uppercase tracking-[0.15em] text-black disabled:cursor-not-allowed disabled:opacity-30">{mounted && isConnected ? "Deposit mUSDC" : "Connect wallet"}</button><p className="mt-4 min-h-5 font-sans text-xs text-white/40">{mounted ? depositState || (userShares.data ? `Your shares: ${formatUnits(userShares.data, 6)}` : "") : ""}</p></aside>
      </section>
    </div>
  </main>;
}