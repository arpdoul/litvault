const PRIVATE_KEY = "YOUR_PRIVATE_KEY_HERE";
const ZKLTC_ADDRESS = "0xc252c356DeA3ccf3cbC0632810563117C628751E";
const RPC = "https://liteforge.rpc.caldera.xyz/http";
const COOLDOWN_MS = 86400000;

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

function encodeMint(address, amount) {
  const sig = "0x40c10f19";
  const addr = address.toLowerCase().replace("0x", "").padStart(64, "0");
  const amt = BigInt(amount).toString(16).padStart(64, "0");
  return sig + addr + amt;
}

function encodeBalanceOf(address) {
  const sig = "0x70a08231";
  const addr = address.toLowerCase().replace("0x", "").padStart(64, "0");
  return sig + addr;
}

async function getBalance(address) {
  const result = await rpc("eth_call", [
    { to: ZKLTC_ADDRESS, data: encodeBalanceOf(address) },
    "latest",
  ]);
  return BigInt(result);
}

async function signAndSend(to, data, pk) {
  const from = await rpc("eth_accounts", []);
  const nonce = await rpc("eth_getTransactionCount", [
    await getAddressFromPK(pk), "latest"
  ]);
  const gasPrice = await rpc("eth_gasPrice", []);
  const chainId = await rpc("eth_chainId", []);

  const tx = {
    nonce,
    gasPrice,
    gas: "0x30000",
    to,
    value: "0x0",
    data,
    chainId,
  };

  const signRes = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_sendTransaction",
      params: [{ ...tx, from: await getAddressFromPK(pk) }],
      id: 1,
    }),
  });
  return (await signRes.json()).result;
}

async function getAddressFromPK(pk) {
  return "0x05026B6f74b5C73D230a32e9EB23A5EAa7F8ea51";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/api/health") {
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    if (url.pathname === "/api/faucet" && request.method === "POST") {
      const { address } = await request.json();
      if (!address || !address.startsWith("0x")) {
        return Response.json({ error: "Invalid address" }, { status: 400, headers: corsHeaders });
      }

      // Check cooldown in KV
      const lastClaim = await env.FAUCET_KV.get(`fc_${address}`);
      if (lastClaim) {
        const diff = Date.now() - parseInt(lastClaim);
        if (diff < COOLDOWN_MS) {
          const hrs = Math.ceil((COOLDOWN_MS - diff) / 3600000);
          return Response.json({ error: `Wait ${hrs}h to claim again` }, { status: 429, headers: corsHeaders });
        }
      }

      try {
        await env.FAUCET_KV.put(`fc_${address}`, Date.now().toString());
        const amount = (1000n * 10n ** 18n).toString();
        const data = encodeMint(address, amount);

        const txHash = await rpc("eth_sendRawTransaction", [
          await buildSignedTx(address, data, env.PRIVATE_KEY || PRIVATE_KEY)
        ]);

        const bal = await getBalance(address);
        return Response.json({
          success: true,
          tx: txHash,
          balance: (bal / 10n ** 18n).toString()
        }, { headers: corsHeaders });
      } catch (e) {
        await env.FAUCET_KV.delete(`fc_${address}`);
        return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
      }
    }

    return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
  }
};
