/* Push only. Intentionally NO fetch handler/cache: never cache health/API/auth. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let type;try{type=event.data?.json()?.type;}catch{}
 const bodies={checkin:'A moment for your chosen focus, if it fits today.',review:'Your focus reflection is ready to revisit.',keep:'A gentle reminder of what you chose to keep.'};
 event.waitUntil(self.registration.showNotification('Sugar Orbits',{body:bodies[type]||'Your Sugar Orbits check-in is ready.',icon:'./app-icon-180.png',badge:'./app-icon-180.png',tag:'orbit-'+(bodies[type]?type:'checkin'),data:{url:new URL('./#focus',self.registration.scope).href}}));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{
 const target=new URL('./#focus',self.registration.scope).href;
 for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})){if(client.url.startsWith(self.registration.scope)){await client.navigate(target);return client.focus();}}
 return self.clients.openWindow(target);
})());});
