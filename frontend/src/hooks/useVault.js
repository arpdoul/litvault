import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { loadDeployment, getVaultContract, getzkLTCContract, formatAmount, parseAmount } from "../utils/contracts.js";

const RENDER_URL = "https://litvault-0q0n.onrender.com";
const LITEFORGE = {
  chainId: "0x1159",
  chainName: "LiteForge Testnet",
  nativeCurrency: { name: "zkLTC", symbol: "zkLTC", decimals: 18 },
  rpcUrls: ["https://liteforge.rpc.caldera.xyz/http"],
  blockExplorerUrls: ["https://liteforge.explorer.caldera.xyz"],
};

export function useWallet() {
  const [address, setAddress] = useState(null);
  const [signer, setSigner] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const ethereum = window.ethereum || window.trustWallet || window.okxwallet || window.coinbaseWalletExtension;
      if (!ethereum) {
        setError("Install MetaMask, Trust Wallet, OKX or Coinbase Wallet");
        return;
      }
      try {
        await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x1159" }] });
      } catch (e) {
        if (e.code === 4902) {
          await ethereum.request({ method: "wallet_addEthereumChain", params: [LITEFORGE] });
        }
      }
      const p = new ethers.BrowserProvider(ethereum);
      await p.send("eth_requestAccounts", []);
      const s = await p.getSigner();
      setSigner(s);
      setAddress(await s.getAddress());
    } catch (e) {
      setError(e.message);
    } finally {
      setConnecting(false);
    }
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.on("accountsChanged", (a) => {
      if (a.length === 0) { setAddress(null); setSigner(null); }
      else connect();
    });
    window.ethereum.on("chainChanged", () => connect());
  }, [connect]);

  return { address, signer, connecting, error, connect };
}

export function useVault(signer, address) {
  const [vaultStats, setVaultStats] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [zkLTCBalance, setZkLTCBalance] = useState("0");
  const [txLoading, setTxLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [deploymentLoaded, setDeploymentLoaded] = useState(false);

  useEffect(() => { loadDeployment().then((d) => setDeploymentLoaded(!!d)); }, []);

  const refresh = useCallback(async () => {
    if (!signer || !address || !deploymentLoaded) return;
    try {
      const vault = await getVaultContract(signer);
      const zkLTC = await getzkLTCContract(signer);
      const [stats, info, bal] = await Promise.all([
        vault.getVaultStats(), vault.getUserInfo(address), zkLTC.balanceOf(address)
      ]);
      setVaultStats({
        totalAssets: formatAmount(stats._totalAssets),
        totalShares: formatAmount(stats._totalShares),
        pricePerShare: formatAmount(stats._pricePerShare),
        totalYield: formatAmount(stats._totalYield),
        lastHarvest: Number(stats._lastHarvest),
        fee: Number(stats._fee),
      });
      setUserInfo({
        shares: formatAmount(info.shares),
        assets: formatAmount(info.assets),
        deposited: formatAmount(info.deposited),
        depositTime: Number(info.depositTime),
      });
      setZkLTCBalance(formatAmount(bal));
    } catch (e) { console.error(e); }
  }, [signer, address, deploymentLoaded]);

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 15000);
    return () => clearInterval(i);
  }, [refresh]);

  const deposit = useCallback(async (amount) => {
    setTxLoading(true); setTxHash(null);
    try {
      const vault = await getVaultContract(signer);
      const zkLTC = await getzkLTCContract(signer);
      const parsed = parseAmount(amount);
      await (await zkLTC.approve(await vault.getAddress(), parsed)).wait();
      const r = await (await vault.deposit(parsed)).wait();
      setTxHash(r.hash);
      await refresh();
    } finally { setTxLoading(false); }
  }, [signer, refresh]);

  const withdraw = useCallback(async (amount) => {
    setTxLoading(true); setTxHash(null);
    try {
      const vault = await getVaultContract(signer);
      const r = await (await vault.withdraw(parseAmount(amount))).wait();
      setTxHash(r.hash);
      await refresh();
    } finally { setTxLoading(false); }
  }, [signer, refresh]);

  const claimFaucet = useCallback(async () => {
    if (!address) return;
    setTxLoading(true);
    try {
      const res = await fetch(RENDER_URL + "/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await refresh();
    } finally { setTxLoading(false); }
  }, [address, refresh]);

  return { vaultStats, userInfo, zkLTCBalance, txLoading, txHash, deposit, withdraw, claimFaucet, refresh };
}
