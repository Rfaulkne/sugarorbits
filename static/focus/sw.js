/* Cache only the public companion shell. NEVER cache health APIs, images, or auth. */
const CACHE='orbit-pocket-v0.10.0';
const ASSETS=['/phone','/focus.css','/focus-client.js','/focus-orbits.js','/phone.js','/phone.webmanifest','/app-icon-180.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('orbit-pocket-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==location.origin)return;const key=url.pathname==='/phone/'?'/phone':url.pathname;if(!ASSETS.includes(key))return;event.respondWith(fetch(event.request).then(r=>{if(r.ok&&url.search===''){const copy=r.clone();caches.open(CACHE).then(c=>c.put(key,copy));}return r;}).catch(()=>caches.match(key)));});
