(()=>{
 const $=id=>document.getElementById(id);let registration=null;
 const standalone=()=>!!navigator.standalone||!!window.matchMedia?.('(display-mode: standalone)').matches;
 const supported=()=>!!navigator.serviceWorker&&typeof PushManager!=='undefined'&&typeof Notification!=='undefined';
 function init(){
  $('install-status').textContent=standalone()?'App-style home-screen mode detected.':'On iPhone, notifications need the Home Screen version, not this browser tab.';
  if(navigator.serviceWorker)registration=navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{registration=null;$('install-status').textContent='App background support could not register. Installation/push still need a device check.';return null;});
 }
 async function enable(config,call){
  if(!supported())throw Error('This browser does not offer Web Push. On iPhone, open the Home Screen app.');
  if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&!standalone())throw Error('Add Sugar Orbits to your Home Screen and open its icon first.');
  if(!config?.reminders_configured||!config.vapid_public_key)throw Error('The reminder function, keys and scheduler still need setup.');
  // Request immediately inside the user's tap, before awaiting registration/network.
  const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Notifications were not allowed. You can change this in iPhone Settings.');
  const reg=await registration;if(!reg)throw Error('Background registration is unavailable. Reload and try again.');
  let sub=await reg.pushManager.getSubscription(),created=false;
  if(!sub){const base=config.vapid_public_key.replace(/-/g,'+').replace(/_/g,'/'),bytes=Uint8Array.from(atob(base+'='.repeat((4-base.length%4)%4)),c=>c.charCodeAt(0));sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});created=true;}
  try{await call({action:'subscribe',subscription:sub.toJSON()});}catch(error){if(created)await sub.unsubscribe();throw error;}
  return 'This phone is registered. Enable a focus reminder below. The first actual notification still needs a delivery test.';
 }
 async function disable(call){const reg=await registration,sub=await reg?.pushManager.getSubscription();if(!sub)return;
  try{await call({action:'unsubscribe',endpoint:sub.endpoint});}finally{await sub.unsubscribe();}
 }
 window.OrbitPWA={init,enable,disable};init();
})();
