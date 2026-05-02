import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import "dotenv/config";
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors()); app.use(express.json());
const provider = new ethers.JsonRpcProvider("https://rpc.testnet.litvm.com");
const dep = () => { const p=join(__dirname,"../../frontend/src/abi/deployment.json"); return existsSync(p)?JSON.parse(readFileSync(p,"utf8")):null; };
const abi = (n) => { const p=join(__dirname,`../../frontend/src/abi/${n}.json`); return existsSync(p)?JSON.parse(readFileSync(p,"utf8")):null; };
app.get("/api/health",(_,res)=>res.json({ok:true,chain:"LiteForge 4441"}));
app.get("/api/vault/stats",async(_,res)=>{const d=dep();if(!d)return res.status(503).json({error:"Not deployed"});try{const v=new ethers.Contract(d.contracts.LitVault,abi("LitVault"),provider);const s=await v.getVaultStats();res.json({totalAssets:ethers.formatEther(s._totalAssets),totalShares:ethers.formatEther(s._totalShares),pricePerShare:ethers.formatEther(s._pricePerShare),addresses:d.contracts});}catch(e){res.status(500).json({error:e.message});}});
app.get("/api/vault/user/:address",async(req,res)=>{const d=dep();if(!d)return res.status(503).json({error:"Not deployed"});try{const v=new ethers.Contract(d.contracts.LitVault,abi("LitVault"),provider);const z=new ethers.Contract(d.contracts.MockzkLTC,abi("MockzkLTC"),provider);const [i,b]=await Promise.all([v.getUserInfo(req.params.address),z.balanceOf(req.params.address)]);res.json({shares:ethers.formatEther(i.shares),assets:ethers.formatEther(i.assets),zkLTCBalance:ethers.formatEther(b)});}catch(e){res.status(500).json({error:e.message});}});
// Gasless faucet — owner mints to user
app.post("/api/faucet", async (req, res) => {
  const { address } = req.body;
  if (!address || !ethers.isAddress(address)) {
    return res.status(400).json({ error: "Invalid address" });
  }
  try {
    const dep = loadDeployment();
    if (!dep) return res.status(503).json({ error: "Not deployed" });
    const raw = process.env.PRIVATE_KEY || "";
    const pk = raw.startsWith("0x") ? raw : "0x" + raw;
    const wallet = new ethers.Wallet(pk, provider);
    const zkLTC = new ethers.Contract(
      dep.contracts.MockzkLTC,
      ["function mint(address to, uint256 amount) external",
       "function balanceOf(address) view returns(uint256)"],
      wallet
    );
    // Check cooldown (1 claim per address per day)
    const lastKey = `faucet_${address}`;
    const now = Date.now();
    if (global[lastKey] && now - global[lastKey] < 86400000) {
      const wait = Math.ceil((86400000 - (now - global[lastKey])) / 3600000);
      return res.status(429).json({ error: `Wait ${wait}h before claiming again` });
    }
    global[lastKey] = now;
    const tx = await zkLTC.mint(address, ethers.parseEther("1000"));
    await tx.wait();
    const bal = await zkLTC.balanceOf(address);
    res.json({ success: true, tx: tx.hash, balance: ethers.formatEther(bal) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.listen(4000,()=>console.log("LitVault API: http://localhost:4000"));
