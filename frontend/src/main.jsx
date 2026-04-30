import React from "react";
import ReactDOM from "react-dom/client";
import { WagmiProvider, createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected } from "@wagmi/connectors";
import App from "./App.jsx";
import "./index.css";
export const liteforge = defineChain({
  id: 4441, name: "LiteForge Testnet",
  nativeCurrency: { name: "zkLTC", symbol: "zkLTC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.litvm.com"] } },
  blockExplorers: { default: { name: "Explorer", url: "https://explorer.testnet.litvm.com" } },
  testnet: true,
});
const config = createConfig({ chains: [liteforge], connectors: [injected()], transports: { [liteforge.id]: http() } });
const queryClient = new QueryClient();
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
