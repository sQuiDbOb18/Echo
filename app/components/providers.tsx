"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const rpcUrl = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL;
const config = createConfig({ chains: [baseSepolia], connectors: [injected()], transports: { [baseSepolia.id]: http(rpcUrl, { retryCount: 3, retryDelay: 1000 }) } });
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000) } } });

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return <WagmiProvider config={config}><QueryClientProvider client={queryClient}><RainbowKitProvider>{children}</RainbowKitProvider></QueryClientProvider></WagmiProvider>;
}