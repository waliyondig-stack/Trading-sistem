// =============================================================
//  TRADE EXECUTOR — Binance USDT-M Futures (default: DEMO/TESTNET)
//  Env wajib di Vercel: BINANCE_KEY, BINANCE_SECRET, APP_PIN
//  Opsional: BINANCE_BASE (default https://demo-fapi.binance.com)
// =============================================================
const crypto = require("crypto");
const BASE = process.env.BINANCE_BASE || "https://demo-fapi.binance.com";

function sign(params) {
  const qs = new URLSearchParams(params).toString();
  const sig = crypto.createHmac("sha256", process.env.BINANCE_SECRET).update(qs).digest("hex");
  return qs + "&signature=" + sig;
}
async function bapi(method, path, params = {}, signed = true) {
  let url = BASE + path, opts = { method, headers: { "X-MBX-APIKEY": process.env.BINANCE_KEY } };
  if (signed) {
    params.timestamp = Date.now();
    params.recvWindow = 10000;
    const q = sign(params);
    if (method === "GET" || method === "DELETE") url += "?" + q;
    else { opts.headers["Content-Type"] = "application/x-www-form-urlencoded"; opts.body = q; }
  } else if (Object.keys(params).length) url += "?" + new URLSearchParams(params).toString();
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j && (j.msg || j.message)) || ("HTTP " + r.status));
  return j;
}

let exCache = null, exAt = 0;
async function filters(symbol) {
  if (!exCache || Date.now() - exAt > 3600e3) {
    exCache = await bapi("GET", "/fapi/v1/exchangeInfo", {}, false);
    exAt = Date.now();
  }
  const s = exCache.symbols.find(x => x.symbol === symbol);
  if (!s) throw new Error("Symbol tidak dikenal: " + symbol);
  const lot = s.filters.find(f => f.filterType === "LOT_SIZE");
  const pf = s.filters.find(f => f.filterType === "PRICE_FILTER");
  return { step: +lot.stepSize, minQty: +lot.minQty, tick: +pf.tickSize };
}
const dec = x => { const s = String(x); const i = s.indexOf("."); return i < 0 ? 0 : (s.length - i - 1); };
const roundStep = (v, step) => (Math.floor(v / step + 1e-9) * step).toFixed(dec(step));
const roundTick = (v, tick) => (Math.round(v / tick) * tick).toFixed(dec(tick));

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type,x-app-pin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!process.env.APP_PIN || req.headers["x-app-pin"] !== process.env.APP_PIN)
    return res.status(401).json({ error: "PIN salah / belum diset (env APP_PIN)" });
  if (!process.env.BINANCE_KEY || !process.env.BINANCE_SECRET)
    return res.status(500).json({ error: "BINANCE_KEY / BINANCE_SECRET belum diisi di Vercel" });

  const action = (req.query && req.query.action) || "";
  try {
    if (action === "ping") {
      const bal = await bapi("GET", "/fapi/v2/balance");
      const usdt = bal.find(b => b.asset === "USDT") || {};
      return res.json({ ok: true, base: BASE, testnet: BASE.includes("demo") || BASE.includes("testnet"),
        balance: +usdt.balance || 0, available: +usdt.availableBalance || 0 });
    }
    if (action === "positions") {
      const [pr, oo] = await Promise.all([
        bapi("GET", "/fapi/v2/positionRisk"),
        bapi("GET", "/fapi/v1/openOrders")
      ]);
      const pos = pr.filter(p => Math.abs(+p.positionAmt) > 0).map(p => ({
        symbol: p.symbol, amt: +p.positionAmt, entry: +p.entryPrice,
        mark: +p.markPrice, uPnl: +p.unRealizedProfit, lev: +p.leverage, liq: +p.liquidationPrice
      }));
      return res.json({ ok: true, positions: pos, openOrders: oo.map(o => ({
        symbol: o.symbol, type: o.type, side: o.side, stopPrice: +o.stopPrice, qty: +o.origQty, reduceOnly: o.reduceOnly })) });
    }
    if (action === "order") {
      const b = req.body || {};
      const { symbol, side, margin, leverage, slPrice, tps } = b;
      if (!symbol || !side || !margin || !leverage || !slPrice || !Array.isArray(tps) || !tps.length)
        throw new Error("Parameter kurang (symbol, side, margin, leverage, slPrice, tps[])");
      if (margin > 10000) throw new Error("Sanity check: margin > 10000 USDT ditolak");
      const f = await filters(symbol);
      const buy = side === "LONG";
      await bapi("POST", "/fapi/v1/leverage", { symbol, leverage: Math.round(leverage) });
      const px = await bapi("GET", "/fapi/v1/premiumIndex", { symbol }, false);
      const mark = +px.markPrice;
      const qty = roundStep(margin * leverage / mark, f.step);
      if (+qty < f.minQty) throw new Error("Ukuran terlalu kecil utk " + symbol + " (min " + f.minQty + ") — naikkan margin");
      const entry = await bapi("POST", "/fapi/v1/order",
        { symbol, side: buy ? "BUY" : "SELL", type: "MARKET", quantity: qty, newOrderRespType: "RESULT" });
      const results = { entry: { orderId: entry.orderId, qty: +entry.executedQty, avgPrice: +entry.avgPrice || mark } };
      const exitSide = buy ? "SELL" : "BUY";
      results.sl = await bapi("POST", "/fapi/v1/order", {
        symbol, side: exitSide, type: "STOP_MARKET", closePosition: "true",
        stopPrice: roundTick(slPrice, f.tick), workingType: "MARK_PRICE"
      }).then(o => ({ orderId: o.orderId, stopPrice: +o.stopPrice }));
      results.tps = [];
      let remaining = +qty;
      for (let i = 0; i < tps.length; i++) {
        const isLast = i === tps.length - 1;
        let q = isLast ? remaining : +roundStep(+qty * (tps[i].portion / 100), f.step);
        if (q < f.minQty) { if (!isLast) continue; q = remaining; }
        if (q <= 0) continue;
        remaining = +(remaining - q).toFixed(dec(f.step) + 2);
        const o = await bapi("POST", "/fapi/v1/order", {
          symbol, side: exitSide, type: "TAKE_PROFIT_MARKET", quantity: String(q),
          reduceOnly: "true", stopPrice: roundTick(tps[i].price, f.tick), workingType: "MARK_PRICE"
        });
        results.tps.push({ i: i + 1, orderId: o.orderId, stopPrice: +o.stopPrice, qty: +o.origQty });
      }
      return res.json({ ok: true, ...results });
    }
    if (action === "close") {
      const { symbol } = req.body || {};
      if (!symbol) throw new Error("symbol wajib");
      await bapi("DELETE", "/fapi/v1/allOpenOrders", { symbol });
      const pr = await bapi("GET", "/fapi/v2/positionRisk", { symbol });
      const p = pr.find(x => x.symbol === symbol && Math.abs(+x.positionAmt) > 0);
      if (!p) return res.json({ ok: true, closed: false, note: "Tidak ada posisi terbuka" });
      const amt = +p.positionAmt;
      const o = await bapi("POST", "/fapi/v1/order", {
        symbol, side: amt > 0 ? "SELL" : "BUY", type: "MARKET",
        quantity: Math.abs(amt), reduceOnly: "true", newOrderRespType: "RESULT"
      });
      return res.json({ ok: true, closed: true, avgPrice: +o.avgPrice, qty: +o.executedQty });
    }
    return res.status(400).json({ error: "action tidak dikenal (ping/positions/order/close)" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
