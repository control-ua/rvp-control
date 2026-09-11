const CACHE='rvp-control-v3';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==self.location.origin)return;
 if(r.mode==='navigate'){e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(CACHE).then(x=>x.put('./',c));return res}).catch(()=>caches.match('./')));return;}
 e.respondWith(caches.match(r).then(c=>c||fetch(r).then(res=>{if(res.ok&&(u.pathname.includes('/assets/')||/\.(png|svg|ico|webmanifest)$/.test(u.pathname))){const q=res.clone();caches.open(CACHE).then(x=>x.put(r,q));}return res})));
});