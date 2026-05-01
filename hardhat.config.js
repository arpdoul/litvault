require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();
const raw = process.env.PRIVATE_KEY || "0".repeat(64);
const PRIVATE_KEY = raw.startsWith("0x") ? raw : "0x" + raw;
module.exports = {
  solidity: { version: "0.8.20", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    liteforge: {
      url: "https://rpc.testnet.litvm.com",
      chainId: 4441,
      accounts: [PRIVATE_KEY],
    },
  },
};
