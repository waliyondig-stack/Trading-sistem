// shell cache ringan — data pasar selalu dari jaringan
const C="ts-v13";
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(["/","/index.html","/manifest.json","/icon.svg"])));self.skipWaiting();});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(u.origin!==location.origin) return; // API Binance/jsonbin: selalu network
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request).then(r=>r||caches.match("/index.html"))));
});
