import { useState, useEffect } from "react";
import { useWallet, useVault } from "./hooks/useVault.js";
import { shortenAddress } from "./utils/contracts.js";
import {
  TrendingUp, Wallet, Zap, Shield, BarChart2,
  ExternalLink, RefreshCw, CheckCircle, Droplets,
  ChevronRight, Activity, Wifi, WifiOff
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const BACKEND = "https://litvault-0q0n.onrender.com";
const RPC = "https://liteforge.rpc.caldera.xyz/http";

const APY_DATA = [
  { day: "Apr 15", apy: 0 }, { day: "Apr 17", apy: 4.2 },
  { day: "Apr 19", apy: 6.8 }, { day: "Apr 21", apy: 5.9 },
  { day: "Apr 23", apy: 8.4 }, { day: "Apr 25", apy: 7.1 },
  { day: "Apr 27", apy: 9.3 }, { day: "Today", apy: 11.2 },
];

// ── Integration 1: Network Status Hook ───────────────────────────────────────
function useNetworkStatus() {
  const [status, setStatus] = useState({ online: null, blockNumber: null, gasPrice: null });

  useEffect(() => {
    async function fetchStatus() {
      try {
        const [blockRes, gasRes] = await Promise.all([
          fetch(RPC, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
          }),
          fetch(RPC, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "eth_gasPrice", params: [], id: 2 }),
          }),
        ]);
        const blockData = await blockRes.json();
        const gasData = await gasRes.json();
        const block = parseInt(blockData.result, 16);
        const gwei = (parseInt(gasData.result, 16) / 1e9).toFixed(4);
        setStatus({ online: true, blockNumber: block.toLocaleString(), gasPrice: gwei });
      } catch {
        setStatus({ online: false, blockNumber: null, gasPrice: null });
      }
    }
    fetchStatus();
    const interval = setInterval(fetchStatus, 12000);
    return () => clearInterval(interval);
  }, []);

  return status;
}

// ── Integration 2: Testnet Status Banner ─────────────────────────────────────
function StatusBanner({ status }) {
  return (
    <div className={`border-b py-2 px-4 transition-all ${
      status.online === null
        ? "bg-vault-panel border-vault-border"
        : status.online
        ? "bg-vault-accent/5 border-vault-accent/20"
        : "bg-red-900/10 border-red-500/20"
    }`}>
      <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {status.online === null ? (
            <div className="w-2 h-2 rounded-full bg-vault-muted animate-pulse" />
          ) : status.online ? (
            <div className="w-2 h-2 rounded-full bg-vault-accent animate-pulse" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-red-400" />
          )}
          <span className={`text-xs font-mono ${
            status.online ? "text-vault-accent" : status.online === false ? "text-red-400" : "text-vault-dim"
          }`}>
            {status.online === null ? "Connecting to LiteForge..." :
             status.online ? "⚡ LiteForge Testnet — Online" : "⚠ Network Offline"}
          </span>
          {status.online && (
            <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-vault-dim">
              <span>Block #{status.blockNumber}</span>
              <span>·</span>
              <span>Gas {status.gasPrice} Gwei</span>
              <span>·</span>
              <span>Chain ID 4441</span>
            </div>
          )}
        </div>
        <a
          href="https://liteforge.explorer.caldera.xyz"
          target="_blank"
          rel="noreferrer"
          className="text-xs font-mono text-vault-dim hover:text-vault-accent transition-colors flex items-center gap-1"
        >
          <ExternalLink size={10} /> View Explorer
        </a>
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = false, icon: Icon }) {
  return (
    <div className={`stat-card glass rounded-2xl p-5 ${accent ? "accent-border" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-vault-dim text-xs font-mono uppercase tracking-widest">{label}</span>
        {Icon && <Icon size={14} className={accent ? "text-vault-accent" : "text-vault-muted"} />}
      </div>
      <div className={`text-2xl font-bold ${accent ? "text-vault-accent" : "text-vault-text"}`}>{value}</div>
      {sub && <div className="text-vault-dim text-xs mt-1 font-mono">{sub}</div>}
    </div>
  );
}

// ── Strategy Row ──────────────────────────────────────────────────────────────
function StrategyRow({ name, allocation, apy, status }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-vault-border last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${status === "active" ? "bg-vault-accent animate-pulse" : "bg-vault-muted"}`} />
        <div>
          <div className="text-sm font-semibold text-vault-text">{name}</div>
          <div className="text-xs font-mono text-vault-dim">{allocation}% allocation</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-mono text-vault-accent">{apy}% APY</div>
        <div className={`text-xs ${status === "active" ? "text-green-400" : "text-vault-muted"}`}>{status}</div>
      </div>
    </div>
  );
}

// ── Vault Panel ───────────────────────────────────────────────────────────────
function VaultPanel({ vaultStats, userInfo, zkLTCBalance, txLoading, txHash, deposit, withdraw, claimFaucet }) {
  const [tab, setTab] = useState("deposit");
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(false);

  const handle = async () => {
    if (!amount || parseFloat(amount) <= 0) { setErr("Enter amount"); return; }
    setErr(null); setOk(false);
    try {
      if (tab === "deposit") await deposit(amount);
      else await withdraw(amount);
      setOk(true); setAmount("");
      setTimeout(() => setOk(false), 5000);
    } catch (e) { setErr(e.reason || e.message || "Failed"); }
  };

  const max = tab === "deposit" ? zkLTCBalance : userInfo?.shares || "0";

  return (
    <div className="glass rounded-3xl p-6 accent-border">
      <div className="flex gap-6 mb-6 border-b border-vault-border pb-4">
        {["deposit", "withdraw"].map(t => (
          <button key={t} onClick={() => { setTab(t); setAmount(""); setErr(null); }}
            className={`font-semibold text-sm pb-1 capitalize transition-all ${tab === t ? "tab-active" : "tab-inactive"}`}>
            {t === "deposit" ? "↓ Deposit" : "↑ Withdraw"}
          </button>
        ))}
      </div>
      <div className="flex justify-between mb-2">
        <span className="text-vault-dim text-xs font-mono">{tab === "deposit" ? "Wallet" : "Shares"}</span>
        <button onClick={() => setAmount(max)} className="text-vault-accent text-xs font-mono hover:underline">
          MAX: {parseFloat(max || 0).toFixed(4)}
        </button>
      </div>
      <div className="relative mb-4">
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.0"
          className="w-full bg-[#0a0f16] border border-vault-border rounded-xl px-4 py-4 text-xl font-mono text-vault-text placeholder-vault-muted focus:outline-none focus:border-vault-accent transition-colors pr-20" />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-vault-dim text-xs font-mono">
          {tab === "deposit" ? "zkLTC" : "lvzkLTC"}
        </span>
      </div>
      {amount && parseFloat(amount) > 0 && (
        <div className="bg-[#0a0f16] rounded-xl p-3 mb-4 text-xs font-mono space-y-1">
          <div className="flex justify-between text-vault-dim">
            <span>You {tab === "deposit" ? "receive" : "get back"}</span>
            <span className="text-vault-text">≈ {parseFloat(amount).toFixed(4)} {tab === "deposit" ? "lvzkLTC" : "zkLTC"}</span>
          </div>
          {tab === "deposit" && (
            <div className="flex justify-between text-vault-dim">
              <span>Est. APY</span><span className="text-vault-accent">~11.2%</span>
            </div>
          )}
        </div>
      )}
      {err && <div className="bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-2 mb-4 text-red-400 text-xs">{err}</div>}
      {ok && txHash && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-xl px-4 py-2 mb-4 text-green-400 text-xs flex items-center gap-2">
          <CheckCircle size={12} />
          <span>TX: {txHash.slice(0, 10)}...{txHash.slice(-6)}</span>
          <a href={`https://liteforge.explorer.caldera.xyz/tx/${txHash}`} target="_blank" rel="noreferrer">
            <ExternalLink size={10} />
          </a>
        </div>
      )}
      <button onClick={handle} disabled={txLoading || !amount}
        className="btn-primary w-full py-4 rounded-xl text-sm uppercase tracking-widest">
        {txLoading
          ? <span className="flex items-center justify-center gap-2"><RefreshCw size={14} className="animate-spin" />{tab === "deposit" ? "Depositing..." : "Withdrawing..."}</span>
          : tab === "deposit" ? "Deposit & Earn" : "Withdraw"}
      </button>
      <button onClick={claimFaucet} disabled={txLoading}
        className="btn-secondary w-full py-3 rounded-xl text-xs mt-3 flex items-center justify-center gap-2">
        <Droplets size={12} /> Claim 1,000 zkLTC Faucet (Gasless)
      </button>
    </div>
  );
}

// ── Integration 3: Built on LiteForge Badge ───────────────────────────────────
function LiteForgebadge() {
  return (
    <a
      href="https://testnet.litvm.com"
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 border border-vault-litvm/40 bg-vault-litvm/5 hover:bg-vault-litvm/10 rounded-full px-3 py-1.5 transition-all group"
    >
      <div className="w-4 h-4 rounded-full bg-vault-litvm/20 border border-vault-litvm/40 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-vault-litvm" />
      </div>
      <span className="text-xs font-mono text-vault-litvm font-semibold group-hover:text-blue-300 transition-colors">
        Built on LiteForge
      </span>
      <ExternalLink size={9} className="text-vault-litvm/60" />
    </a>
  );
}

// ── LitVM Powered Badge (for footer) ─────────────────────────────────────────
function LitVMPoweredBadge() {
  return (
    <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-start">
      <a href="https://www.litvm.com" target="_blank" rel="noreferrer"
        className="flex items-center gap-2 text-vault-dim hover:text-vault-litecoin transition-colors group">
        <div className="w-5 h-5 rounded border border-vault-litecoin/30 group-hover:border-vault-litecoin/60 flex items-center justify-center transition-colors">
          <div className="w-2.5 h-2.5 rounded-sm bg-vault-litecoin/50 group-hover:bg-vault-litecoin transition-colors" />
        </div>
        <span className="text-xs font-mono">Powered by LitVM</span>
      </a>
      <span className="text-vault-border">·</span>
      <a href="https://bitcoinos.build" target="_blank" rel="noreferrer"
        className="text-xs font-mono text-vault-dim hover:text-vault-gold transition-colors">
        Secured by BitcoinOS
      </a>
      <span className="text-vault-border">·</span>
      <a href="https://arbitrum.io" target="_blank" rel="noreferrer"
        className="text-xs font-mono text-vault-dim hover:text-blue-400 transition-colors">
        Arbitrum Orbit Stack
      </a>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { address, signer, connecting, error: wErr, connect } = useWallet();
  const { vaultStats, userInfo, zkLTCBalance, txLoading, txHash, deposit, withdraw, claimFaucet } = useVault(signer, address);
  const networkStatus = useNetworkStatus();

  // Keep backend alive
  useEffect(() => {
    const ping = () => fetch(BACKEND + "/api/health").catch(() => {});
    ping();
    const id = setInterval(ping, 14 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen">

      {/* Integration 2: Live Status Banner */}
      <StatusBanner status={networkStatus} />

      {/* Header */}
      <header className="glass border-b border-vault-border sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-vault-accent/20 border border-vault-accent/40 flex items-center justify-center">
              <Zap size={16} className="text-vault-accent" />
            </div>
            <span className="font-bold text-lg shimmer-text">LitVault</span>
            {/* Integration 3: Badge in header */}
            <LiteForgebadge />
          </div>
          <div>
            {address
              ? <div className="flex items-center gap-2 bg-vault-panel border border-vault-border rounded-xl px-3 py-2">
                  <div className="w-2 h-2 rounded-full bg-vault-accent animate-pulse" />
                  <span className="font-mono text-xs">{shortenAddress(address)}</span>
                </div>
              : <button onClick={connect} disabled={connecting}
                  className="btn-primary px-4 py-2 rounded-xl text-xs flex items-center gap-2">
                  <Wallet size={12} />{connecting ? "Connecting..." : "Connect Wallet"}
                </button>
            }
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-vault-accent/10 border border-vault-accent/20 rounded-full px-4 py-1.5 mb-6">
            <Activity size={12} className="text-vault-accent" />
            <span className="text-vault-accent text-xs font-mono">Live on LiteForge Testnet</span>
          </div>
          <h1 className="font-bold text-4xl sm:text-5xl text-vault-text mb-3">
            zkLTC Yield <span className="shimmer-text">Aggregator</span>
          </h1>
          <p className="text-vault-dim max-w-md mx-auto mb-6">
            Deposit zkLTC. Earn auto-compounded yield. One vault, maximum returns.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="TVL" value={`${vaultStats?.totalAssets || "0.0000"} zkLTC`} sub="Total Value Locked" icon={TrendingUp} accent />
          <StatCard label="Est. APY" value="~11.2%" sub="Auto-compounded" icon={BarChart2} />
          <StatCard label="Price/Share" value={vaultStats?.pricePerShare || "1.0000"} sub="lvzkLTC → zkLTC" icon={ChevronRight} />
          <StatCard label="Perf. Fee" value={vaultStats ? `${vaultStats.fee / 100}%` : "5%"} sub="On yield only" icon={Shield} />
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* APY Chart */}
            <div className="glass rounded-3xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold text-vault-text">APY History</h2>
                <span className="text-vault-accent text-sm font-mono">~11.2% current</span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={APY_DATA}>
                  <defs>
                    <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fill: "#718096", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#718096", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #1a2332", borderRadius: 8, fontSize: 11 }}
                    formatter={v => [`${v}%`, "APY"]} />
                  <Area type="monotone" dataKey="apy" stroke="#00d4aa" strokeWidth={2} fill="url(#ag)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Strategies */}
            <div className="glass rounded-3xl p-6">
              <h2 className="font-bold text-vault-text mb-4">Active Strategies</h2>
              <StrategyRow name="LiteForge DEX LP" allocation={50} apy={12.4} status="active" />
              <StrategyRow name="LendVault Lending" allocation={30} apy={8.9} status="active" />
              <StrategyRow name="Ayni Cross-chain" allocation={20} apy={15.1} status="active" />
            </div>

            {/* User position */}
            {address && userInfo && (
              <div className="glass rounded-3xl p-6">
                <h2 className="font-bold text-vault-text mb-4">Your Position</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Shares", value: parseFloat(userInfo.shares || 0).toFixed(4) + " lvzkLTC" },
                    { label: "Value", value: parseFloat(userInfo.assets || 0).toFixed(4) + " zkLTC" },
                    { label: "Deposited", value: parseFloat(userInfo.deposited || 0).toFixed(4) + " zkLTC" },
                    { label: "Wallet", value: parseFloat(zkLTCBalance || 0).toFixed(4) + " zkLTC" },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-[#0a0f16] rounded-xl p-3">
                      <div className="text-vault-dim text-xs font-mono mb-1">{label}</div>
                      <div className="text-vault-text text-sm font-mono font-semibold">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div>
            {!address
              ? <div className="glass rounded-3xl p-8 accent-border text-center">
                  <Wallet size={32} className="text-vault-accent mx-auto mb-4" />
                  <h3 className="font-bold text-vault-text mb-2">Connect to Deposit</h3>
                  <p className="text-vault-dim text-sm mb-1">MetaMask, Trust Wallet, OKX, Coinbase</p>
                  <p className="text-vault-dim text-xs mb-6 font-mono">LiteForge Testnet · Chain 4441</p>
                  <button onClick={connect} disabled={connecting}
                    className="btn-primary w-full py-3 rounded-xl text-sm">
                    {connecting ? "Connecting..." : "Connect Wallet"}
                  </button>
                  {wErr && <p className="text-red-400 text-xs mt-3">{wErr}</p>}
                </div>
              : <VaultPanel vaultStats={vaultStats} userInfo={userInfo} zkLTCBalance={zkLTCBalance}
                  txLoading={txLoading} txHash={txHash}
                  deposit={deposit} withdraw={withdraw} claimFaucet={claimFaucet} />
            }

            {/* Info cards */}
            <div className="glass rounded-2xl p-4 mt-4 space-y-3">
              {[
                { icon: Shield, text: "Non-custodial. Your keys, your funds." },
                { icon: Zap, text: "0.4s blocks, sub-cent gas fees." },
                { icon: TrendingUp, text: "Auto-compounding every harvest." },
                { icon: Droplets, text: "Gasless faucet — no gas needed to claim." },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-start gap-3">
                  <Icon size={12} className="text-vault-accent mt-0.5 shrink-0" />
                  <span className="text-vault-dim text-xs">{text}</span>
                </div>
              ))}
            </div>

            {/* Integration 3: LitVM ecosystem card */}
            <div className="glass rounded-2xl p-4 mt-4 border border-vault-litvm/20">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-vault-litvm animate-pulse" />
                <span className="text-vault-litvm text-xs font-mono font-semibold uppercase tracking-wider">
                  LitVM Ecosystem
                </span>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Network", value: "LiteForge Testnet" },
                  { label: "Chain ID", value: "4441" },
                  { label: "Stack", value: "Arbitrum Orbit" },
                  { label: "Settlement", value: "BitcoinOS ZK" },
                  { label: "Gas Token", value: "zkLTC" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-vault-dim text-xs font-mono">{label}</span>
                    <span className="text-vault-litecoin text-xs font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-vault-border space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Zap size={12} className="text-vault-accent" />
              <span className="font-semibold text-sm shimmer-text">LitVault</span>
              <span className="text-vault-dim text-xs font-mono">· zkLTC Yield Aggregator</span>
            </div>
            <div className="flex gap-4 text-xs font-mono text-vault-dim">
              <a href="https://liteforge.explorer.caldera.xyz" target="_blank" rel="noreferrer"
                className="hover:text-vault-accent flex items-center gap-1"><ExternalLink size={10} /> Explorer</a>
              <a href="https://github.com/arpdoul/litvault" target="_blank" rel="noreferrer"
                className="hover:text-vault-accent flex items-center gap-1"><ExternalLink size={10} /> GitHub</a>
              <a href="https://builders.litvm.com" target="_blank" rel="noreferrer"
                className="hover:text-vault-accent flex items-center gap-1"><ExternalLink size={10} /> Builders</a>
              <a href="https://docs.litvm.com" target="_blank" rel="noreferrer"
                className="hover:text-vault-accent flex items-center gap-1"><ExternalLink size={10} /> Docs</a>
            </div>
          </div>

          {/* Integration 3: Full LitVM powered section */}
          <div className="pt-4 border-t border-vault-border/50">
            <LitVMPoweredBadge />
          </div>
        </footer>
      </div>
    </div>
  );
}
