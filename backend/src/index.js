import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

const RPC = "https://liteforge.rpc.caldera.xyz/http";
const provider = new ethers.JsonRpcProvider(RPC);

const CONTRACTS = {
  LitVault: "0x24b653b62533427E0b70e92c0e3a3E4D15597e64",
  MockzkLTC: "0xc252c356DeA3ccf3cbC0632810563117C628751E",
};

const VAULT_ABI = ["function getVaultStats() view returns(uint256,uint256,uint256,uint256,uint256,uint256)","function getUserInfo(address) view returns(uint256,uint256,uint256,uint256)"];
const ZKLTC_ABI = ["function mint(address,uint256) external","function balanceOf(address) view returns(uint256)"];

const cooldowns = {};

app.get("/api/health", (_, res) => res.json({ ok: true, chain: "LiteForge 4441" }));

app.get("/api/vault/stats", async (_, res) => {
  try {
    const vault = new ethers.Contract(CONTRACTS.LitVault, VAULT_ABI, provider);
    const s = await vault.getVaultStats();
    res.json({
      totalAssets: ethers.formatEther(s[0]),
      totalShares: ethers.formatEther(s[1]),
      pricePerShare: ethers.formatEther(s[2]),
      addresses: CONTRACTS,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/vault/user/:address", async (req, res) => {
  try {
    const vault = new ethers.Contract(CONTRACTS.LitVault, VAULT_ABI, provider);
    const zkLTC = new ethers.Contract(CONTRACTS.MockzkLTC, ZKLTC_ABI, provider);
    const [info, bal] = await Promise.all([vault.getUserInfo(req.params.address), zkLTC.balanceOf(req.params.address)]);
    res.json({ shares: ethers.formatEther(info[0]), assets: ethers.formatEther(info[1]), zkLTCBalance: ethers.formatEther(bal) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/faucet", async (req, res) => {
  const { address } = req.body;
  if (!address || !ethers.isAddress(address)) {
    return res.status(400).json({ error: "Invalid address" });
  }
  const now = Date.now();
  if (cooldowns[address] && now - cooldowns[address] < 86400000) {
    const hrs = Math.ceil((86400000 - (now - cooldowns[address])) / 3600000);
    return res.status(429).json({ error: `Wait ${hrs}h to claim again` });
  }
  try {
    const raw = process.env.PRIVATE_KEY || "";
    const pk = raw.startsWith("0x") ? raw : "0x" + raw;
    const wallet = new ethers.Wallet(pk, provider);
    const zkLTC = new ethers.Contract(CONTRACTS.MockzkLTC, ZKLTC_ABI, wallet);
    cooldowns[address] = now;
    const tx = await zkLTC.mint(address, ethers.parseEther("1000"));
    await tx.wait();
    const bal = await zkLTC.balanceOf(address);
    res.json({ success: true, tx: tx.hash, balance: ethers.formatEther(bal) });
  } catch (e) {
    delete cooldowns[address];
    res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 4000, () => {
  console.log("LitVault backend running");
  console.log("Contracts:", CONTRACTS);
});
