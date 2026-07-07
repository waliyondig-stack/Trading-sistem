// =============================================================
//  SIGNAL SCANNER 24 JAM — kirim notifikasi Telegram saat
//  Sniper 8/8 atau Simons 6/6 VALID (eksekusi tetap manual).
//  Env wajib : APP_PIN (kunci pemicu), TELEGRAM_TOKEN
//  Env opsional: TELEGRAM_CHAT (auto-deteksi bila kosong),
//    JSONBIN_ID + JSONBIN_KEY (baca pengaturan & watchlist app),
//    SCAN_TF (default "15m"), APP_URL (link di pesan)
//  Pemicu: cron-job.org → GET /api/scan?key=APP_PIN tiap 1-2 mnt
// =============================================================
const DATA_HOSTS = ["https://api.binance.com", "https://data-api.binance.vision", "https://api1.binance.com"];
const HTF_MAP = { "1m": "15m", "5m": "1h", "15m": "4h", "1h": "4h", "4h": "1d", "1d": "1w" };
const DEFAULT_PAIRS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT"];
const BBASE = process.env.BINANCE_BASE || "https://demo-fapi.binance.com";
const STYLES = { Scalping:{lev:20,risk:2.0,slRoe:0.10}, Intraday:{lev:10,risk:1.5,slRoe:0.10}, Swing:{lev:5,risk:1.0,slRoe:0.10} };
const GUARDS = { killDayPct:-5, maxOpenPos:2, maxTradesDay:6, cooldownAfterSL:2, cooldownMin:120 };
function styleFromTF(tf){ return (tf==="1h")?"Intraday":(tf==="4h"||tf==="1d")?"Swing":"Scalping"; }
const TF_MIN={"1m":1,"5m":5,"15m":15,"1h":60,"4h":240,"1d":1440};
function tsMinutes(style,tf,styleCfg){
  const defC={Scalping:12,Intraday:10,Swing:16};
  const key=style.toLowerCase();
  const sc=(styleCfg||{})[key]||{};
  const candles=+(sc.ts||defC[style]||12);
  return candles*(TF_MIN[tf]||5);
}
async function putBin(rec){
  const id=process.env.JSONBIN_ID, key=process.env.JSONBIN_KEY;
  const r=await fetch("https://api.jsonbin.io/v3/b/"+id,{method:"PUT",
    headers:{"Content-Type":"application/json","X-Master-Key":key},
    body:JSON.stringify(rec)});
  if(!r.ok) throw new Error("PUT bin HTTP "+r.status);
}
function buildPaperItem(sym, side, tf, a, mode, sm, settings, grade){
  const dir = side==="LONG"?"Long":"Short";
  const styleName = styleFromTF(tf);
  const prof = STYLES[styleName];
  const scKey = styleName.toLowerCase();
  const scfg = (settings.styleCfg||{})[scKey]||{};
  const now = Date.now();
  const wib = new Date(now + 7*3600*1000);
  const feeP = settings.fee!=null?settings.fee:0.05;
  let lev, margin, slPrice, tps;
  if(mode==="SIMONS" && sm){
    const slPct=Math.abs(a.last-sm.sl)/a.last;
    lev=Math.min(+(scfg.lev||prof.lev), Math.max(2, Math.floor(0.475/Math.max(slPct,0.001))));
    margin=+(((settings.modal*(prof.risk/100))/(slPct*lev)).toFixed(2));
    slPrice=sm.sl;
    tps=[{roe:null,price:sm.tp1,portion:50,hit:false},{roe:null,price:sm.tp2,portion:50,hit:false}];
  }else{
    lev=+(scfg.lev||prof.lev);
    margin=+((settings.modal*(prof.risk/100)/prof.slRoe).toFixed(2));
    slPrice=netRoePrice(a.last,side,lev,-prof.slRoe,feeP);
    const n=Math.abs(a.score)>=5?4:Math.abs(a.score)===4?3:Math.abs(a.score)===3?2:1;
    const roes=[0.20,0.40,0.60,1.00].slice(0,n);
    const SPLIT={1:[100],2:[60,40],3:[50,30,20],4:[40,30,20,10]};
    tps=roes.map((r,i)=>({roe:r,price:netRoePrice(a.last,side,lev,r,feeP),portion:SPLIT[n][i],hit:false}));
  }
  return {
    id: now + Math.floor(Math.random()*1000),
    date: wib.toISOString().slice(0,10),
    tin: wib.toTimeString?wib.toTimeString().slice(0,5):(wib.getUTCHours()+":"+wib.getUTCMinutes()),
    pair: sym, dir, style: styleName, lev, margin,
    entry: a.last, slPrice, slRoe: mode==="SIMONS"?null:prof.slRoe, be:false,
    tps, grade: grade||"B", smc: a.smc||null, setup: "Robot "+mode, status:"open",
    openedAt: now, tsMin: tsMinutes(styleName, tf, settings.styleCfg),
    ctx:{ mode, robot:1, tf, score:a.score, smcK:a.smc?["bos","sweep","ob","fvg","pd"].filter(k=>a.smc[k]).length:0,
      adx:+(a.adx||0).toFixed(1), atrPct:a.atr?+(a.atr/a.last*100).toFixed(3):null,
      z:+(a.z||0).toFixed(2), rvol:a.rvol!=null?+a.rvol.toFixed(2):null,
      timeWIB: wib.getUTCHours().toString().padStart(2,"0")+":"+wib.getUTCMinutes().toString().padStart(2,"0"),
      dow: wib.getUTCDay(), hour: wib.getUTCHours(), driftEntry:0, tpMode:tps.length,
      sess:"ROBOT" }
  };
}
async function paperRecord(item, chat, appUrl){
  // read-modify-write: ambil rec terbaru, tambah antrean, simpan
  const id=process.env.JSONBIN_ID, key=process.env.JSONBIN_KEY;
  const j=await (await fetch("https://api.jsonbin.io/v3/b/"+id+"/latest",{headers:{"X-Master-Key":key}})).json();
  const rec=j.record||{};
  const now=Date.now();
  rec.robotQueue=(rec.robotQueue||[]).filter(x=>x&&x.openedAt&&now-x.openedAt<48*3600*1000).slice(-19);
  if(rec.robotQueue.find(x=>x.id===item.id)) return false;
  // 1 pair 1 posisi: cek posisi terbuka & antrean
  const openPairs=new Set([...(rec.positions||[]).map(x=>x.pair), ...rec.robotQueue.map(x=>x.pair)]);
  if(openPairs.has(item.pair)) return false;
  if((rec.positions||[]).length + rec.robotQueue.length >= 4) return false; // maks 4 posisi paper
  rec.robotQueue.push(item);
  rec._t=now;
  await putBin(rec);
  await tg("sendMessage",{chat_id:chat,parse_mode:"HTML",disable_web_page_preview:true,
    text:"🤖📝 <b>AUTO-PAPER — "+item.pair+" "+item.dir+"</b> ("+((item.ctx&&item.ctx.mode)||"")+"·"+item.style+")\nTF "+((item.ctx&&item.ctx.tf)||"")+" · entry "+item.entry+" · "+item.lev+"x · margin "+item.margin+"\nSL "+item.slPrice+" · TP×"+item.tps.length+"\n📥 masuk antrean jurnal — dimonitor saat aplikasi terbuka\n<a href=\""+appUrl+"\">Buka aplikasi</a>"});
  return true;
}
function netRoePrice(entry,dir,lev,roe,feePct){
  const f=feePct/100, m=1, N=m*lev, U=entry>0?N/entry:0;
  if(U===0) return null;
  if(dir==="LONG") return (m*roe + entry*U + N*f)/(U*(1-f));
  return (entry*U - N*f - m*roe)/(U*(1+f));
}
function tpSteps(score){ const st=Math.abs(score);
  return st>=5?[0.20,0.40,0.60,1.00]:st>=4?[0.20,0.40,0.60]:st>=3?[0.20,0.40]:[0.20]; }
function tpPortions(n){ return n===1?[100]:n===2?[60,40]:n===3?[50,30,20]:[40,30,20,10]; }
const DEF = {
  sniper: { minScore: 3, minSmc: 3, adxMin: 23, rsiHi: 72, rsiLo: 28, useHtf: true, useBtc: true, useMacd: true, useWindow: true },
  simons: { zMin: 2, adxMax: 23, rsiS: 65, rsiL: 35 },
  weekendResearch: false
};

// ---------- indikator (PORT IDENTIK dari aplikasi) ----------
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

// ---------- infrastruktur ----------
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
        weekendResearch: !!rec.settings.weekendResearch,
        autoPilot: rec.settings.autoPilot || "off",
        styleCfg: rec.settings.styleCfg || {},
        fee: rec.settings.fee != null ? rec.settings.fee : 0.05,
        modal: +rec.settings.modal || 500
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

// anti-spam dalam memori (bertahan selama fungsi hangat; cold start bisa mengirim ulang 1x — dapat diterima)
// ---------- eksekutor Binance (identik trade.js) ----------
const crypto = require("crypto");
function bsign(params){ const qs=new URLSearchParams(params).toString();
  return qs+"&signature="+crypto.createHmac("sha256",process.env.BINANCE_SECRET).update(qs).digest("hex"); }
async function bapi(method,path,params={},signed=true){
  let url=BBASE+path, opts={method,headers:{"X-MBX-APIKEY":process.env.BINANCE_KEY}};
  if(signed){ params.timestamp=Date.now(); params.recvWindow=10000; const q=bsign(params);
    if(method==="GET"||method==="DELETE") url+="?"+q;
    else{ opts.headers["Content-Type"]="application/x-www-form-urlencoded"; opts.body=q; } }
  else if(Object.keys(params).length) url+="?"+new URLSearchParams(params).toString();
  const r=await fetch(url,opts); const j=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error((j&&(j.msg||j.message))||("HTTP "+r.status));
  return j;
}
let exCache=null, exAt=0;
async function bfilters(symbol){
  if(!exCache||Date.now()-exAt>3600e3){ exCache=await bapi("GET","/fapi/v1/exchangeInfo",{},false); exAt=Date.now(); }
  const s=exCache.symbols.find(x=>x.symbol===symbol);
  if(!s) throw new Error("Symbol? "+symbol);
  const lot=s.filters.find(f=>f.filterType==="LOT_SIZE"), pf=s.filters.find(f=>f.filterType==="PRICE_FILTER");
  return {step:+lot.stepSize, minQty:+lot.minQty, tick:+pf.tickSize};
}
const bdec=x=>{const s=String(x);const i=s.indexOf(".");return i<0?0:(s.length-i-1);};
const rStep=(v,st)=>(Math.floor(v/st+1e-9)*st).toFixed(bdec(st));
const rTick=(v,tk)=>(Math.round(v/tk)*tk).toFixed(bdec(tk));

// ---------- REM / GUARDS (stateless: baca langsung dari exchange) ----------
async function guardState(){
  const [bal, posRisk, income] = await Promise.all([
    bapi("GET","/fapi/v2/balance"),
    bapi("GET","/fapi/v2/positionRisk"),
    bapi("GET","/fapi/v1/income",{incomeType:"REALIZED_PNL",startTime:(()=>{const d=new Date(Date.now()+7*3600e3);d.setUTCHours(0,0,0,0);return d.getTime()-7*3600e3;})(),limit:100})
  ]);
  const usdt=bal.find(b=>b.asset==="USDT")||{};
  const balance=+usdt.balance||0;
  const open=posRisk.filter(p=>Math.abs(+p.positionAmt)>0);
  const pnlToday=income.reduce((a,x)=>a+(+x.income||0),0);
  const tradesToday=income.length;
  // cooldown: 2 realized pnl NEGATIF berturut paling akhir, dlm cooldownMin terakhir
  const sorted=[...income].sort((a,b)=>b.time-a.time);
  let streak=0; for(const x of sorted){ if(+x.income<0) streak++; else break; }
  const lastLossTime=sorted.length&&+sorted[0].income<0?sorted[0].time:0;
  const inCooldown= streak>=GUARDS.cooldownAfterSL && (Date.now()-lastLossTime) < GUARDS.cooldownMin*60*1000;
  return {balance, open, openSyms:open.map(p=>p.symbol), pnlToday, tradesToday, inCooldown, streak};
}
function guardCheck(gs){
  const blocks=[];
  if(gs.balance<=0) blocks.push("saldo 0");
  if(gs.pnlToday <= gs.balance*GUARDS.killDayPct/100) blocks.push("KILL-SWITCH: P/L hari ini "+gs.pnlToday.toFixed(2)+" ≤ "+GUARDS.killDayPct+"%");
  if(gs.open.length >= GUARDS.maxOpenPos) blocks.push("maks "+GUARDS.maxOpenPos+" posisi terbuka");
  if(gs.tradesToday >= GUARDS.maxTradesDay) blocks.push("maks "+GUARDS.maxTradesDay+" trade/hari");
  if(gs.inCooldown) blocks.push("cooldown "+GUARDS.cooldownAfterSL+" SL beruntun");
  return blocks;
}

// ---------- EKSEKUSI satu sinyal ----------
async function autoExecute(sym, side, tf, a, kind, sm, settings, gs){
  const styleName=styleFromTF(tf);
  const prof=STYLES[styleName];
  const cfg=(settings.styleCfg||{})[styleName]||{};
  const fee=settings.fee!=null?settings.fee:0.05;
  const f=await bfilters(sym);
  const px=await bapi("GET","/fapi/v1/premiumIndex",{symbol:sym},false);
  const mark=+px.markPrice;
  let lev, margin, slPrice, tps=[];
  if(kind==="SIMONS"){
    const slPct=Math.abs(mark-sm.sl)/mark;
    const levMax=Math.max(2,Math.floor(0.475/slPct));
    lev=Math.min(cfg.mode==="auto"?levMax:Math.round(cfg.lev||prof.lev), levMax, 25);
    margin=(gs.balance*(prof.risk/100))/(slPct*lev);
    margin=Math.min(margin, gs.balance*0.5);
    slPrice=sm.sl;
    tps=[{price:sm.tp1,portion:50},{price:sm.tp2,portion:50}];
  }else{
    if(cfg.mode==="auto"){ const atrFrac=a.atr/mark; lev=Math.round(prof.slRoe/(atrFrac||0.005)); }
    else lev=Math.round(cfg.lev||prof.lev);
    lev=Math.min(Math.max(lev,2),25);
    margin=(gs.balance*0.2); // basis 20% saldo (kompounding) — risk 2% pada SL −10% ROE
    if(styleName!=="Scalping") margin=gs.balance*(prof.risk/100)/prof.slRoe;
    margin=Math.min(margin, gs.balance*0.5);
    slPrice=netRoePrice(mark, side, lev, -prof.slRoe, fee);
    const steps=tpSteps(a.score), por=tpPortions(steps.length);
    tps=steps.map((r,i)=>({price:netRoePrice(mark,side,lev,r,fee),portion:por[i]}));
  }
  margin=+margin.toFixed(2);
  await bapi("POST","/fapi/v1/leverage",{symbol:sym,leverage:lev});
  const qty=rStep(margin*lev/mark, f.step);
  if(+qty<f.minQty) throw new Error("qty < minQty");
  const entry=await bapi("POST","/fapi/v1/order",{symbol:sym,side:side==="LONG"?"BUY":"SELL",type:"MARKET",quantity:qty,newOrderRespType:"RESULT"});
  const exitSide=side==="LONG"?"SELL":"BUY";
  await bapi("POST","/fapi/v1/order",{symbol:sym,side:exitSide,type:"STOP_MARKET",closePosition:"true",stopPrice:rTick(slPrice,f.tick),workingType:"MARK_PRICE"});
  let remaining=+qty; const placed=[];
  for(let i=0;i<tps.length;i++){
    const isLast=i===tps.length-1;
    let q=isLast?remaining:+rStep(+qty*(tps[i].portion/100),f.step);
    if(q<f.minQty){ if(!isLast) continue; q=remaining; }
    if(q<=0) continue;
    remaining=+(remaining-q).toFixed(bdec(f.step)+2);
    await bapi("POST","/fapi/v1/order",{symbol:sym,side:exitSide,type:"TAKE_PROFIT_MARKET",quantity:String(q),reduceOnly:"true",stopPrice:rTick(tps[i].price,f.tick),workingType:"MARK_PRICE"});
    placed.push(tps[i]);
  }
  return {avg:+entry.avgPrice||mark, qty:+entry.executedQty, lev, margin, slPrice, tps:placed, styleName};
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
    // auto-deteksi chat id bila TELEGRAM_CHAT kosong
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

    const tfs = ((req.query && req.query.tf) || process.env.SCAN_TFS || process.env.SCAN_TF || "15m,1h").split(",").map(x=>x.trim()).filter(Boolean).slice(0,3);
    const appUrl = process.env.APP_URL || "https://trading-sistem.vercel.app";
    const { settings, pairs, binErr } = await loadAppState();
    const autoOn = settings.autoPilot === "auto" && !!process.env.BINANCE_KEY && !!process.env.BINANCE_SECRET;
    const paperOn = settings.autoPilot === "paper" && !!process.env.JSONBIN_ID && !!process.env.JSONBIN_KEY;
    const paperLog=[];
    let gs=null, guardBlocks=null, execLog=[];
    if(autoOn){
      try{ gs=await guardState(); guardBlocks=guardCheck(gs); }
      catch(e){ guardBlocks=["exchange error: "+e.message]; }
    }

    // BTC bias utk filter sniper
    const hits = [], scanned = [];
    for(const tf of tfs){
    let btc = null;
    try {
      const klB = await klines("BTCUSDT", HTF_MAP[tf] || "1h", 60);
      const b = htfBias(klB);
      const closes = klB.slice(0, -1).map(c => +c[4]);
      const e9 = ema(closes, 9), e21 = ema(closes, 21);
      btc = { bull: b.bull, neutral: Math.abs(e9[e9.length - 1] - e21[e21.length - 1]) / closes[closes.length - 1] < 0.0008 };
    } catch (e) { }

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
          hits.push(sym + " SNIPER " + tf);
          if(paperOn){
            try{
              const it=buildPaperItem(sym, snp.side, tf, a, "SNIPER", null, settings, snp.grade);
              const okP=await paperRecord(it, chat, appUrl);
              if(okP) paperLog.push("SNIPER "+sym+" "+snp.side);
            }catch(e){ paperLog.push("PAPER GAGAL "+sym+": "+e.message.slice(0,40)); }
          }
          if(autoOn && guardBlocks && guardBlocks.length===0 && !gs.openSyms.includes(sym)){
            try{
              const ex=await autoExecute(sym, snp.side, tf, a, "SNIPER", null, settings, gs);
              gs.openSyms.push(sym); gs.open.push({symbol:sym}); gs.tradesToday++;
              execLog.push("SNIPER "+sym+" "+snp.side+" @"+ex.avg);
              await tg("sendMessage",{chat_id:chat,parse_mode:"HTML",text:`🤖 <b>AUTO-ENTRY 🎯 ${sym} ${snp.side}</b> (${ex.styleName} ${tf})\nEntry ${ex.avg} · qty ${ex.qty} · ${ex.lev}x · margin ${ex.margin}\nSL ${(+ex.slPrice).toFixed(6)} · TP ${ex.tps.map(t=>t.price.toFixed(6)+"("+t.portion+"%)").join(" ")}\nSkor ${a.score} · SMC ${snp.grade} · ADX ${snp.adx.toFixed(0)}`});
            }catch(e){ execLog.push("GAGAL "+sym+": "+e.message);
              await tg("sendMessage",{chat_id:chat,text:"⚠️ AUTO gagal entry "+sym+": "+e.message}); }
          }
          await tg("sendMessage", {
            chat_id: chat, parse_mode: "HTML", disable_web_page_preview: true,
            text: `🎯 <b>SNIPER VALID — ${sym} ${snp.side}</b>\nTF ${tf} · harga ${a.last}\nSkor ${a.score > 0 ? "+" : ""}${a.score} · SMC ${snp.grade} · ADX ${snp.adx.toFixed(0)} · RVOL ${a.rvol.toFixed(2)}\nSesi: ${snp.sess}\n\n👉 <a href="${appUrl}">Buka aplikasi & eksekusi</a>`
          });
        }
        if (smv.valid && shouldSend("smv-" + sym + "-" + tf, candleT)) {
          hits.push(sym + " SIMONS " + tf);
          if(paperOn){
            try{
              const closedP=kl.slice(0,-1);
              const hi10=Math.max(...closedP.slice(-10).map(c=>+c[2])), lo10=Math.min(...closedP.slice(-10).map(c=>+c[3]));
              const smaW=a.closes.slice(-20); const mean=smaW.reduce((x,y)=>x+y,0)/smaW.length;
              const buf=0.25*atrCalc(closedP);
              const smP={ sl: smv.side==="SHORT"? hi10+buf : lo10-buf, tp2: mean, mean };
              smP.tp1 = a.last + (mean-a.last)*0.5;
              const rrP=Math.abs(smP.tp2-a.last)/Math.abs(a.last-smP.sl);
              if(rrP>=0.8){
                const it=buildPaperItem(sym, smv.side, tf, a, "SIMONS", smP, settings, "MR");
                const okP=await paperRecord(it, chat, appUrl);
                if(okP) paperLog.push("SIMONS "+sym+" "+smv.side);
              }
            }catch(e){ paperLog.push("PAPER GAGAL "+sym+": "+e.message.slice(0,40)); }
          }
          if(autoOn && guardBlocks && guardBlocks.length===0 && !gs.openSyms.includes(sym)){
            try{
              // level struktural utk simons: hitung dari data yang ada
              const closed=kl.slice(0,-1);
              const hi10=Math.max(...closed.slice(-10).map(c=>+c[2])), lo10=Math.min(...closed.slice(-10).map(c=>+c[3]));
              const smaW=a.closes.slice(-20); const mean=smaW.reduce((x,y)=>x+y,0)/smaW.length;
              const buf=0.25*atrCalc(closed);
              const sm={ sl: smv.side==="SHORT"? hi10+buf : lo10-buf, tp2: mean };
              sm.tp1 = a.last + (mean-a.last)*0.5;
              const rr=Math.abs(sm.tp2-a.last)/Math.abs(a.last-sm.sl);
              if(rr<0.8) throw new Error("R:R ke mean < 0.8");
              const ex=await autoExecute(sym, smv.side, tf, a, "SIMONS", sm, settings, gs);
              gs.openSyms.push(sym); gs.open.push({symbol:sym}); gs.tradesToday++;
              execLog.push("SIMONS "+sym+" "+smv.side+" @"+ex.avg);
              await tg("sendMessage",{chat_id:chat,parse_mode:"HTML",text:`🤖 <b>AUTO-ENTRY 🧬 ${sym} ${smv.side}</b> (mean-rev ${tf})\nEntry ${ex.avg} · qty ${ex.qty} · ${ex.lev}x · margin dinamis ${ex.margin}\nSL struktural ${(+ex.slPrice).toFixed(6)} · TP ${ex.tps.map(t=>t.price.toFixed(6)+"("+t.portion+"%)").join(" ")}\n|z| ${Math.abs(smv.z).toFixed(2)} · RSI ${a.rsi.toFixed(0)}`});
            }catch(e){ execLog.push("GAGAL "+sym+": "+e.message);
              await tg("sendMessage",{chat_id:chat,text:"⚠️ AUTO gagal entry "+sym+": "+e.message}); }
          }
          await tg("sendMessage", {
            chat_id: chat, parse_mode: "HTML", disable_web_page_preview: true,
            text: `🧬 <b>MEAN-REV VALID — ${sym} ${smv.side}</b>\nTF ${tf} · harga ${a.last}\n|z| ${Math.abs(smv.z).toFixed(2)} · RSI ${a.rsi.toFixed(0)} · ADX ${a.adx.toFixed(0)} · RVOL ${a.rvol.toFixed(2)}\nSesi: ${smv.sess}\n\n👉 <a href="${appUrl}">Buka aplikasi & eksekusi</a>`
          });
        }
      } catch (e) { scanned.push(sym + ":ERR " + e.message.slice(0, 40)); }
    }
    } // end for tfs
    return res.json({ ok: true, tfs, pairs: pairs.length, hits, scanned,
      paper: paperOn ? {active:true, recorded:paperLog} : undefined,
      autoPilot: autoOn ? (guardBlocks && guardBlocks.length ? {blocked:guardBlocks} : {active:true, exec:execLog, openPos:gs?gs.open.length:null, pnlToday:gs?+gs.pnlToday.toFixed(2):null}) : "off",
      binErr: binErr || null, wib: nowWIB().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
