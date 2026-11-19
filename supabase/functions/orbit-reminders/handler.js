// Scheduler only: gateway JWT OFF; scoped ORBIT_REMINDER_TOKEN required.
// No AI, glucose fetch or private text is needed to send a reminder.
import webpush from 'npm:web-push@3.6.5';
const R=window.OrbitRhythm,F=window.OrbitFocusCore;
const PROJECT='https://hinknpgmmhkqphsgvuek.supabase.co';
const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const safeEndpoint=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&['web.push.apple.com','fcm.googleapis.com','updates.push.services.mozilla.com'].includes(u.hostname);}catch{return false;}};
async function handler(req){
 if(req.headers.has('origin'))return reply(403,{message:'Server only.'});if(req.method!=='POST')return reply(405,{message:'Use POST.'});
 const expected=Deno.env.get('ORBIT_REMINDER_TOKEN')||'',actual=req.headers.get('x-orbit-reminder-token')||'';
 if(!/^[a-f0-9]{64}$/.test(expected))return reply(503,{message:'Reminder token missing.'});
 if(!/^[a-f0-9]{64}$/.test(actual))return reply(401,{message:'Scheduler authentication required.'});
 const hash=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const [a,b]=await Promise.all([hash(actual),hash(expected)]);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];if(diff)return reply(401,{message:'Scheduler authentication failed.'});
 const owner=Deno.env.get('DEXCOM_OWNER_USER_ID'),publicKey=Deno.env.get('ORBIT_VAPID_PUBLIC_KEY'),privateKey=Deno.env.get('ORBIT_VAPID_PRIVATE_KEY'),subject=Deno.env.get('ORBIT_VAPID_SUBJECT');
 if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(owner||'')||!publicKey||!privateKey||!subject?.startsWith('mailto:'))return reply(503,{message:'Reminder settings incomplete.'});
 let service;try{service=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');}catch{}
 if(!service)return reply(503,{message:'Server configuration incomplete.'});
 const db=async(path,method='GET',body=null)=>{const r=await fetch(PROJECT+'/rest/v1/'+path,{method,headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',Prefer:method==='POST'?'resolution=ignore-duplicates,return=representation':'return=representation'},...(body===null?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('storage');return r.status===204?null:r.json();};
 try{
  const now=Date.now();
  await db('orbit_focus_plans?expires_at=lte.'+encodeURIComponent(new Date(now).toISOString()),'DELETE');
  await db('orbit_push_devices?updated_at=lt.'+encodeURIComponent(new Date(now-28*864e5).toISOString()),'DELETE');
  const plans=await db('orbit_focus_plans?select=id,plan&user_id=eq.'+owner+'&expires_at=gt.'+encodeURIComponent(new Date(now).toISOString())+'&limit=5');
  const devices=await db('orbit_push_devices?select=id,subscription&user_id=eq.'+owner+'&limit=3');
  let accepted=0,failed=0;
  for(const record of plans){const due=F.due(record.plan,now,R);if(!due)continue;
   for(const device of devices){if(!safeEndpoint(device.subscription?.endpoint))continue;
    const claimed=await db('orbit_push_deliveries?on_conflict=plan_id,device_id,day_key,kind','POST',{plan_id:record.id,device_id:device.id,day_key:due.key,kind:due.type});if(!claimed?.length)continue;
    let state='failed';
    try{
     const details=webpush.generateRequestDetails(device.subscription,JSON.stringify({type:due.type}),{vapidDetails:{subject,publicKey,privateKey},TTL:900,urgency:'normal'});
     // Endpoint allowlist + no redirects prevents subscriptions becoming an SSRF proxy.
     const result=await fetch(details.endpoint,{method:'POST',headers:details.headers,body:details.body,redirect:'error',signal:AbortSignal.timeout(10000)});
     if(result.ok){state='accepted';accepted++;}else{failed++;if([404,410].includes(result.status))await db('orbit_push_devices?id=eq.'+device.id+'&user_id=eq.'+owner,'DELETE');}
    }catch{failed++;}
    await db('orbit_push_deliveries?id=eq.'+claimed[0].id,'PATCH',{state});
   }
  }
  // "Accepted" means the push service accepted it, not that the phone displayed it.
  return reply(200,{ok:true,accepted,failed});
 }catch{return reply(502,{message:'Reminder run could not complete. No raw errors or health details returned.'});}
}
Deno.serve(handler);
