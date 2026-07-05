// =============================================================
//  SIGNAL SCANNER 24 JAM — kirim notifikasi Telegram saat
//  Sniper 8/8 atau Simons 6/6 VALID (eksekusi tetap manual).
//  Env wajib : APP_PIN (kunci pemicu), TELEGRAM_TOKEN
//  Env opsional: TELEGRAM_CHAT (auto-deteksi bila kosong),
//    JSONBIN_ID + JSONBIN_KEY (baca pengaturan & watchlist app),
//    SCAN_TF (default "15m"), APP_URL (link di pesan)
//  Pemicu: cron-job.org -> GET /api/scan?key=APP_PIN tiap 1-2 mnt
// =============================================================
const DATA_HOSTS = ["https://api.binance.com", "https://data-api.binance.vision", "https://api1.binance.com"];
const HTF_MAP = { "1m": "15m", "5m": "1h", "15m": "4h", "1h": "4h", "4h": "1d", "1d": "1w" };
const DEFAULT_PAIRS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT"];
const DEF = {
  sniper: { minScore: 3, minSmc: 3, adxMin: 23, rsiHi: 72, rsiLo: 28, useHtf: true, useBtc: true, useMacd: true, useWindow: true },
  simons: { zMin: 2, adxMax: 23, rsiS: 65, rsiL: 35 },
  weekendResearch: false
};

function ema(arr, n) { const k = 2 / (n + 1); let e = arr.slice(0, n).reduce((a, b) => a + b, 0) / n; const o = new Array(arr.length).fill(null); o[n - 1] = e; for (let i = n; i < arr.length; i++) { e = arr[i] * k + e * (1 - k); o[i] = e; } return o; }
function rsiCalc(c, n = 14) { let g = 0, l = 0; for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; d >= 0 ? g += d : l -= d; } let ag = g / n, al = l / n; for (let i = n + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; ag = (ag * (n - 1) + Math.max(d, 0)) / n; al = (al * (n - 1) + Math.max(-d, 0)) / n; } return al === 0 ? 100 : 100 - 100 / (1 + ag / al); }
function macdHist(c) { const e12 = ema(c, 12), e26 = ema(c, 26); const line = c.map((_, i) => e12[i] != null && e26[i] != null ? e12[i] - e26[i] : null).filter(v => v != null); const sig = ema(line, 9); return { h: line[line.length - 1] - sig[sig.length - 1], rising: (line[line.length - 1] - sig[sig.length - 1]) > (line[line.length - 2] - sig[sig.length - 2]) }; }
function atrCalc(kl, n = 14) { let s = 0; for (let i = kl.length - n; i < kl.length; i++) { const h = +kl[i][2], lo = +kl[i][3], pc = +kl[i - 1][4]; s += Math.max(h - lo, Math.abs(h - pc), Math.abs(lo - pc)); } return s / n; }
function vwapCalc(kl) { let pv = 0, v = 0; for (const c of kl.slice(-30)) { const tp = (+c[2] + +c[3] + +c[4]) / 3; pv += tp * +c[5]; v += +c[5]; } return v ? pv / v : null; }
function adx(kl, n = 14) {
  const H = kl.map(c => +c[2]), L = kl.map(c => +c[3]), C = kl.map(c => +c[4]);
  let trs = [], pdm = [], ndm = [];
  for (let i = 1; i < kl.length; i++) {
    trs.push(Math.max(H[i] - L[i], Math.abs(H[i] - C[i - 1]), Math.abs(L[i] - C[i - 1])));
    const up = H[i] - H[i - 1], dn = L[i - 1] - L[i];
    pdm.push(up > dn && up > 0 ? up : 0); ndm.push(dn > up && dn > 0 ? dn : 0);
  }
  let atr = trs.slice(0, n).reduce((a, b) => a + b, 0), pD = pdm.slice(0, n).reduce((a, b) => a + b, 0), nD = ndm.slice(0, n).reduce((a, b) => a + b, 0);
  let dxs = [];
  for (let i = n; i < trs.length; i++) {
    atr = atr - atr / n + trs[i]; pD = pD - pD / n + pdm[i]; nD = nD - nD / n + ndm[i];
    const pdi = 100 * pD / atr, ndi = 100 * nD / atr;
    dxs.push(100 * Math.abs(pdi - ndi) / ((pdi + ndi) || 1));
  }
  if (dxs.length < n) return 0;
  let a = dxs.slice(0, n).reduce((x, y) => x + y, 0) / n;
  for (let i = n; i < dxs.length; i++) a = (a * (n - 1) + dxs[i]) / n;
  return a;
}
function detectSMC(kl, dir) {
  const H = kl.map(c => +c[2]), L = kl.map(c => +c[3]), O = kl.map(c => +c[1]), C = kl.map(c => +c[4]);
  const n = kl.length, last = C[n - 1], long = (dir === "Long");
  const sh = [], sl = [];
  for (let i = 2; i < n - 2; i++) {
    const hN = [H[i - 2], H[i - 1], H[i + 1], H[i + 2]], lN = [L[i - 2], L[i - 1], L[i + 1], L[i + 2]];
    if (hN.every(x => H[i] >= x) && H[i] > Math.min(...hN)) sh.push({ i, p: H[i] });
    if (lN.every(x => L[i] <= x) && L[i] < Math.max(...lN)) sl.push({ i, p: L[i] });
  }
  let bos = false;
  const ref = long ? sh.filter(x => x.i < n - 6) : sl.filter(x => x.i < n - 6);
  if (ref.length) {
    const lv = ref[ref.length - 1].p;
    const recent = C.slice(-6);
    bos = long ? recent.some(c => c > lv) : recent.some(c => c < lv);
  }
  let sweep = false;
  for (let j = Math.max(4, n - 12); j < n && !sweep; j++) {
    const prior = (long ? sl : sh).filter(x => x.i < j - 1);
    if (!prior.length) continue;
    const lv = prior[prior.length - 1].p;
    if (long && L[j] < lv && C[j] > lv) sweep = true;
    if (!long && H[j] > lv && C[j] < lv) sweep = true;
  }
  let ob = false;
  const avgBody = kl.slice(-20).reduce((a, c) => a + Math.abs(+c[4] - +c[1]), 0) / 20;
  for (let i = n - 20; i < n - 1; i++) {
    const bear = C[i] < O[i], bull = C[i] > O[i];
    const body2 = Math.abs(C[i + 1] - O[i + 1]);
    if (long && bear && C[i + 1] > O[i + 1] && body2 > 1.5 * avgBody && C[i + 1] > H[i]) { ob = true; break; }
    if (!long && bull && C[i + 1] < O[i + 1] && body2 > 1.5 * avgBody && C[i + 1] < L[i]) { ob = true; break; }
  }
  let fvg = false;
  for (let i = n - 15; i < n; i++) {
    if (i < 2) continue;
    if (long && L[i] > H[i - 2] && last > H[i - 2]) { fvg = true; break; }
    if (!long && H[i] < L[i - 2] && last < L[i - 2]) { fvg = true; break; }
  }
  const win = kl.slice(-60);
  const hi = Math.max(...win.map(c => +c[2])), lo = Math.min(...win.map(c => +c[3]));
  const eq = (hi + lo) / 2;
  const pd = long ? last < eq : last > eq;
  return { bos, sweep, ob, fvg, pd };
}
function smcGradeOf(smc) { if (!smc) return { g: "B", k: 0 }; const k = ["bos", "sweep", "ob", "fvg", "pd"].filter(x => smc[x]).length; return { g: k >= 3 ? "A+" : k >= 1 ? "A" : "B", k }; }
function analyze(kl) {
  const closed = kl.slice(0, -1), closes = closed.map(c => +c[4]), last = closes[closes.length - 1];
  const e9 = ema(closes, 9), e21 = ema(closes, 21);
  const r = rsiCalc(closes), m = macdHist(closes);
  const vols = closed.map(c => +c[5]);
  const avgVol = vols.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  const rvol = avgVol > 0 ? vols[vols.length - 1] / avgVol : 1;
  const volSpike = rvol > 1.5;
  const green = +closed[closed.length - 1][4] > +closed[closed.length - 1][1];
  const vw = vwapCalc(closed), a = atrCalc(closed);
  let score = 0; const v = {};
  v.ema = e9[e9.length - 1] > e21[e21.length - 1] ? 1 : -1; score += v.ema;
  v.rsi = r > 55 ? 1 : r < 45 ? -1 : 0; if (r > 75) v.rsi = -1; if (r < 25) v.rsi = 1; score += v.rsi;
  v.macd = m.h > 0 && m.rising ? 1 : m.h < 0 && !m.rising ? -1 : 0; score += v.macd;
  v.vol = volSpike ? (green ? 1 : -1) : 0; score += v.vol;
  v.vwap = vw ? (last > vw ? 1 : -1) : 0; score += v.vwap;
  let cls = "netral";
  if (score >= 2) cls = "long"; else if (score <= -2) cls = "short";
  const smc = cls !== "netral" ? detectSMC(closed, cls === "long" ? "Long" : "Short") : null;
  const w20 = closes.slice(-20);
  const sma = w20.reduce((x, y) => x + y, 0) / w20.length;
  const sd = Math.sqrt(w20.reduce((x, y) => x + (y - sma) * (y - sma), 0) / w20.length);
  const z = sd > 0 ? (last - sma) / sd : 0;
  return { last, rsi: r, volSpike, rvol, atr: a, score, v, cls, smc, z, closes };
}
function htfBias(kl) { const closes = kl.slice(0, -1).map(c => +c[4]); const e9 = ema(closes, 9), e21 = ema(closes, 21); return { bull: e9[e9.length - 1] > e21[e21.length - 1], rsi: rsiCalc(closes) }; }
function nowWIB() { return new Date(Date.now() + 7 * 3600 * 1000); }
function sessionStatus(settings) {
  const d = nowWIB(), day = d.getUTCDay(), mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  if (day === 0 || day === 6) return { trade: !!settings.weekendResearch, label: settings.weekendResearch ? "RISET WEEKEND" : "WEEKEND" };
  if (day === 5 && mins >= 22 * 60) return { trade: false, label: "JUMAT>22" };
  if (mins >= 840 && mins < 1020) return { trade: true, label: "WINDOW #1" };
  if (mins >= 1170 && mins < 1380) return { trade: true, label: "WINDOW #2" };
  return { trade: false, label: "LUAR WINDOW" };
}
function sniperCheck(a, klClosed, htf, btc, tf, settings) {
  if (a.cls === "netral") return { valid: false };
  const long = a.cls === "long";
  const cfg = settings.sniper;
  const adxV = adx(klClosed);
  const gr = smcGradeOf(a.smc);
  const scalpTF = (tf === "1m" || tf === "5m" || tf === "15m");
  const sess = sessionStatus(settings);
  const conds = [
    cfg.useHtf ? (long ? htf.bull : !htf.bull) : true,
    Math.abs(a.score) >= cfg.minScore,
    gr.k >= cfg.minSmc,
    adxV >= cfg.adxMin,
    long ? htf.rsi < cfg.rsiHi : htf.rsi > cfg.rsiLo,
    cfg.useMacd ? (long ? a.v.macd > 0 : a.v.macd < 0) : true,
    cfg.useBtc ? (btc == null ? true : (btc.neutral || (long ? btc.bull : !btc.bull))) : true,
    scalpTF ? (cfg.useWindow ? sess.trade : true) : true
  ];
  return { valid: conds.every(Boolean), side: long ? "LONG" : "SHORT", adx: adxV, grade: gr.g, sess: sess.label };
}
function simonsCheck(a, tf, settings) {
  const cfg = settings.simons || DEF.simons;
  const z = a.z || 0;
  const dir = z > 0 ? "SHORT" : "LONG";
  const closes = a.closes, n = closes.length;
  const trigger = dir === "SHORT" ? closes[n - 1] < closes[n - 2] : closes[n - 1] > closes[n - 2];
  const momAgainst = a.volSpike && ((z > 0 && a.v.vol > 0) || (z < 0 && a.v.vol < 0));
  const scalpTF = (tf === "1m" || tf === "5m" || tf === "15m");
  const sess = sessionStatus(settings);
  const conds = [
    (a.adx || 0) < cfg.adxMax,
    Math.abs(z) >= cfg.zMin,
    dir === "SHORT" ? a.rsi >= cfg.rsiS : a.rsi <= cfg.rsiL,
    trigger, !momAgainst,
    scalpTF ? sess.trade : true
  ];
  return { valid: conds.every(Boolean), side: dir, z, sess: sess.label };
}

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status + " " + url.slice(0, 60));
  return r.json();
}
async function klines(sym, tf, limit) {
  let err;
  for (const h of DATA_HOSTS) {
    try { return await fetchJson(`${h}/api/v3/klines?symbol=${sym}&interval=${tf}&limit=${limit}`); }
    catch (e) { err = e; }
  }
  throw err;
}
async function loadAppState() {
  const id = process.env.JSONBIN_ID, key = process.env.JSONBIN_KEY;
  const out = { settings: { ...DEF }, pairs: DEFAULT_PAIRS };
  if (!id || !key) return out;
  try {
    const j = await (await fetch(`https://api.jsonbin.io/v3/b/${id}/latest`, { headers: { "X-Master-Key": key } })).json();
    const rec = j.record || {};
    if (rec.settings) {
      out.settings = {
        sniper: { ...DEF.sniper, ...(rec.settings.sniper || {}) },
        simons: { ...DEF.simons, ...(rec.settings.simons || {}) },
        weekendResearch: !!rec.settings.weekendResearch
      };
    }
    if (Array.isArray(rec.active) && rec.active.length) out.pairs = rec.active.slice(0, 10);
    else if (Array.isArray(rec.tokens) && rec.tokens.length) out.pairs = rec.tokens.slice(0, 10).map(t => typeof t === "string" ? t : t.sym || t.symbol).filter(Boolean);
  } catch (e) { out.binErr = e.message; }
  return out;
}
async function tg(method, params) {
  const token = process.env.TELEGRAM_TOKEN;
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params)
  });
  return r.json();
}

let sent = {};
function shouldSend(key, candleT) {
  const rec = sent[key];
  if (rec && (rec.candleT === candleT || Date.now() - rec.at < 30 * 60 * 1000)) return false;
  sent[key] = { candleT, at: Date.now() };
  if (Object.keys(sent).length > 200) sent = {};
  return true;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (!process.env.APP_PIN || (req.query && req.query.key) !== process.env.APP_PIN)
    return res.status(401).json({ error: "key salah (pakai ?key=APP_PIN)" });
  if (!process.env.TELEGRAM_TOKEN)
    return res.status(500).json({ error: "TELEGRAM_TOKEN belum diisi di Vercel" });

  try {
    let chat = process.env.TELEGRAM_CHAT;
    if (!chat) {
      const u = await tg("getUpdates", {});
      const msg = (u.result || []).reverse().find(x => x.message && x.message.chat);
      if (msg) {
        chat = String(msg.message.chat.id);
        await tg("sendMessage", { chat_id: chat, text: "✅ Scanner terhubung!\n\nCHAT ID kamu: " + chat + "\n\nSimpan angka ini sebagai env TELEGRAM_CHAT di Vercel (lalu Redeploy) supaya permanen." });
        return res.json({ ok: true, note: "Chat ID ditemukan & dikirim ke Telegram-mu. Isi env TELEGRAM_CHAT=" + chat + " lalu Redeploy.", chatId: chat });
      }
      return res.json({ ok: false, note: "TELEGRAM_CHAT kosong & belum ada pesan masuk. Buka bot-mu di Telegram, kirim /start, lalu panggil URL ini lagi." });
    }

    const tf = (req.query && req.query.tf) || process.env.SCAN_TF || "15m";
    const appUrl = process.env.APP_URL || "https://trading-sistem.vercel.app";
    const { settings, pairs, binErr } = await loadAppState();

    let btc = null;
    try {
      const klB = await klines("BTCUSDT", HTF_MAP[tf] || "1h", 60);
      const b = htfBias(klB);
      const closes = klB.slice(0, -1).map(c => +c[4]);
      const e9 = ema(closes, 9), e21 = ema(closes, 21);
      btc = { bull: b.bull, neutral: Math.abs(e9[e9.length - 1] - e21[e21.length - 1]) / closes[closes.length - 1] < 0.0008 };
    } catch (e) { }

    const hits = [], scanned = [];
    for (const sym of pairs) {
      try {
        const [kl, klH] = await Promise.all([klines(sym, tf, 120), klines(sym, HTF_MAP[tf] || "1h", 60)]);
        const closed = kl.slice(0, -1);
        const candleT = closed[closed.length - 1][0];
        const a = analyze(kl);
        a.adx = adx(closed);
        const htf = htfBias(klH);
        const snp = sniperCheck(a, closed, htf, sym === "BTCUSDT" ? null : btc, tf, settings);
        const smv = simonsCheck(a, tf, settings);
        scanned.push(sym + ":" + (snp.valid ? "SNP✓" : "") + (smv.valid ? "MR✓" : "") + (!snp.valid && !smv.valid ? "-" : ""));
        if (snp.valid && shouldSend("snp-" + sym + "-" + tf, candleT)) {
          hits.push(sym + " SNIPER");
          await tg("sendMessage", {
            chat_id: chat, parse_mode: "HTML", disable_web_page_preview: true,
            text: `🎯 <b>SNIPER VALID — ${sym} ${snp.side}</b>\nTF ${tf} · harga ${a.last}\nSkor ${a.score > 0 ? "+" : ""}${a.score} · SMC ${snp.grade} · ADX ${snp.adx.toFixed(0)} · RVOL ${a.rvol.toFixed(2)}\nSesi: ${snp.sess}\n\n👉 <a href="${appUrl}">Buka aplikasi & eksekusi</a>`
          });
        }
        if (smv.valid && shouldSend("smv-" + sym + "-" + tf, candleT)) {
          hits.push(sym + " SIMONS");
          await tg("sendMessage", {
            chat_id: chat, parse_mode: "HTML", disable_web_page_preview: true,
            text: `🧬 <b>MEAN-REV VALID — ${sym} ${smv.side}</b>\nTF ${tf} · harga ${a.last}\n|z| ${Math.abs(smv.z).toFixed(2)} · RSI ${a.rsi.toFixed(0)} · ADX ${a.adx.toFixed(0)} · RVOL ${a.rvol.toFixed(2)}\nSesi: ${smv.sess}\n\n👉 <a href="${appUrl}">Buka aplikasi & eksekusi</a>`
          });
        }
      } catch (e) { scanned.push(sym + ":ERR " + e.message.slice(0, 40)); }
    }
    return res.json({ ok: true, tf, pairs: pairs.length, hits, scanned, binErr: binErr || null, wib: nowWIB().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
