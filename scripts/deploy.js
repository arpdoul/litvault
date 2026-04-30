const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "zkLTC");
  console.log("Deploying MockzkLTC...");
  const MockzkLTC = await ethers.getContractFactory("MockzkLTC");
  const mockzkLTC = await MockzkLTC.deploy();
  await mockzkLTC.waitForDeployment();
  const zkLTCAddress = await mockzkLTC.getAddress();
  console.log("MockzkLTC:", zkLTCAddress);
  console.log("Deploying LitVault...");
  const LitVault = await ethers.getContractFactory("LitVault");
  const vault = await LitVault.deploy(zkLTCAddress, deployer.address, deployer.address);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("LitVault:", vaultAddress);
  const tx = await vault.addStrategy(deployer.address, 10000, "LiteForge DEX LP");
  await tx.wait();
  console.log("Strategy registered");
  const deployment = {
    network: "liteforge-testnet", chainId: 4441,
    deployedAt: new Date().toISOString(), deployer: deployer.address,
    contracts: { MockzkLTC: zkLTCAddress, LitVault: vaultAddress },
  };
  const outDir = path.join(__dirname, "../frontend/src/abi");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "deployment.json"), JSON.stringify(deployment, null, 2));
  const vaultABI = require("../artifacts/contracts/LitVault.sol/LitVault.json");
  const zkLTCABI = require("../artifacts/contracts/MockzkLTC.sol/MockzkLTC.json");
  fs.writeFileSync(path.join(outDir, "LitVault.json"), JSON.stringify(vaultABI.abi, null, 2));
  fs.writeFileSync(path.join(outDir, "MockzkLTC.json"), JSON.stringify(zkLTCABI.abi, null, 2));
  console.log("DONE! Explorer: https://explorer.testnet.litvm.com/address/" + vaultAddress);
}
main().catch((e) => { console.error(e); process.exit(1); });
