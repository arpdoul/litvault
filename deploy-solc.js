import { ethers } from "ethers";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { config } from "dotenv";
config();

const RPC = "https://liteforge.rpc.caldera.xyz/http";
const raw = process.env.PRIVATE_KEY || "";
const PK = raw.startsWith("0x") ? raw : "0x" + raw;

const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, provider);

function load(name) {
  const abi = JSON.parse(readFileSync(`out/${name}.abi`, "utf8"));
  const bin = "0x" + readFileSync(`out/${name}.bin`, "utf8").trim();
  return { abi, bin };
}

async function main() {
  console.log("Deployer:", wallet.address);
  const bal = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(bal), "zkLTC\n");

  console.log("Deploying MockzkLTC...");
  const zkltc = load("contracts_MockzkLTC_sol_MockzkLTC");
  const zkFactory = new ethers.ContractFactory(zkltc.abi, zkltc.bin, wallet);
  const zkContract = await zkFactory.deploy();
  await zkContract.waitForDeployment();
  const zkAddr = await zkContract.getAddress();
  console.log("MockzkLTC:", zkAddr);

  console.log("\nDeploying LitVault...");
  const vault = load("contracts_LitVault_sol_LitVault");
  const vFactory = new ethers.ContractFactory(vault.abi, vault.bin, wallet);
  const vContract = await vFactory.deploy(zkAddr, wallet.address, wallet.address);
  await vContract.waitForDeployment();
  const vAddr = await vContract.getAddress();
  console.log("LitVault:", vAddr);

  console.log("\nRegistering strategy...");
  const tx = await vContract.addStrategy(wallet.address, 10000, "LiteForge DEX LP");
  await tx.wait();
  console.log("Strategy registered!");

  const deployment = {
    network: "liteforge-testnet",
    chainId: 4441,
    deployedAt: new Date().toISOString(),
    deployer: wallet.address,
    contracts: { MockzkLTC: zkAddr, LitVault: vAddr },
  };

  const outDir = "frontend/src/abi";
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/deployment.json`, JSON.stringify(deployment, null, 2));
  writeFileSync(`${outDir}/LitVault.json`, JSON.stringify(zkltc.abi, null, 2));
  writeFileSync(`${outDir}/MockzkLTC.json`, JSON.stringify(vault.abi, null, 2));

  console.log("\n✅ DONE!");
  console.log("MockzkLTC :", zkAddr);
  console.log("LitVault  :", vAddr);
  console.log("Explorer  : https://explorer.testnet.litvm.com/address/" + vAddr);
}

main().catch(e => { console.error(e); process.exit(1); });
