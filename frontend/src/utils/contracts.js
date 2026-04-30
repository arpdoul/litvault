import { ethers } from "ethers";
let DEPLOYMENT = null;
export async function loadDeployment() {
  try { const mod = await import("../abi/deployment.json"); DEPLOYMENT = mod.default; return DEPLOYMENT; }
  catch { return null; }
}
export function getAddresses() {
  if (!DEPLOYMENT) return { vault: null, zkLTC: null };
  return { vault: DEPLOYMENT.contracts.LitVault, zkLTC: DEPLOYMENT.contracts.MockzkLTC };
}
export async function getVaultContract(s) {
  const { default: abi } = await import("../abi/LitVault.json");
  const { vault } = getAddresses();
  if (!vault) throw new Error("Not deployed");
  return new ethers.Contract(vault, abi, s);
}
export async function getzkLTCContract(s) {
  const { default: abi } = await import("../abi/MockzkLTC.json");
  const { zkLTC } = getAddresses();
  if (!zkLTC) throw new Error("Not deployed");
  return new ethers.Contract(zkLTC, abi, s);
}
export const formatAmount = (v, d=18, p=4) => { try { return parseFloat(ethers.formatUnits(v,d)).toFixed(p); } catch { return "0.0000"; } };
export const parseAmount = (v, d=18) => ethers.parseUnits(v.toString(), d);
export const shortenAddress = (a) => a ? a.slice(0,6)+"..."+a.slice(-4) : "";
export async function switchToLiteForge() {
  if (!window.ethereum) throw new Error("No wallet");
  try { await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x1159" }] }); }
  catch (e) {
    if (e.code === 4902) await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0x1159", chainName: "LiteForge Testnet", nativeCurrency: { name: "zkLTC", symbol: "zkLTC", decimals: 18 }, rpcUrls: ["https://rpc.testnet.litvm.com"], blockExplorerUrls: ["https://explorer.testnet.litvm.com"] }] });
    else throw e;
  }
}
