"use client";
import { WagmiProvider, createConfig, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { CHAIN } from "../lib/config";

const config = createConfig({
  chains: [CHAIN],
  transports: { [CHAIN.id]: http() },
  connectors: [farcasterMiniApp()],
});
const queryClient = new QueryClient();

export default function Providers({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
