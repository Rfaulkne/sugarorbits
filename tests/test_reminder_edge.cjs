const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const R=require('../cloud-phone/rhythm.js'),now=Date.now(),minute=R.local(now).minute;
let handler,claimed=false,accepted=0,deliveries=[],removed=false,endpoint='https://web.push.apple.com/test-only';
const owner='11111111-1111-4111-8111-111111111111',token='a'.repeat(64);
const plan={started:now-864e5,kind:'activity',start:0,status:'active',checkins:{},reminder:{enabled:true,lead:0,minute,quiet_start:0,quiet_end:0,frequency:1}};
const ctx={window:{},Response,Request,URL,TextEncoder,TextDecoder,Date,Map,Set,Number,JSON,Error,Array,Object,Intl,Math,encodeURIComponent,AbortSignal,crypto:require('node:crypto').webcrypto,
 webpush:{generateRequestDetails:(s,p,o)=>{assert.deepEqual(JSON.parse(p),{type:'checkin'});assert.equal(o.TTL,900);return {endpoint:s.endpoint,headers:{},body:'encrypted-mock'};}},
 Deno:{env:{get:n=>({ORBIT_REMINDER_TOKEN:token,DEXCOM_OWNER_USER_ID:owner,SUPABASE_SECRET_KEYS:'{}',SUPABASE_SERVICE_ROLE_KEY:'server-only',ORBIT_VAPID_PUBLIC_KEY:'pub',ORBIT_VAPID_PRIVATE_KEY:'priv',ORBIT_VAPID_SUBJECT:'mailto:owner@example.invalid'})[n]},serve:fn=>handler=fn},
 fetch:async(url,opt={})=>{
  if(url.startsWith('https://web.push.apple.com/')){assert.equal(opt.redirect,'error');accepted++;return new Response('',{status:201});}
  assert.equal(opt.headers.Authorization,'Bearer server-only');
  if(opt.method==='DELETE'){removed=true;return Response.json([]);}
  if(url.includes('orbit_focus_plans')){assert.ok(url.includes('user_id=eq.'+owner));return Response.json([{id:'plan-id',plan}]);}
  if(url.includes('orbit_push_devices'))return Response.json([{id:'device-id',subscription:{endpoint,keys:{}}}]);
  if(url.includes('orbit_push_deliveries')&&opt.method==='POST'){if(claimed)return Response.json([]);claimed=true;deliveries.push(JSON.parse(opt.body));return Response.json([{id:1}]);}
  if(url.includes('orbit_push_deliveries'))return Response.json([]);
  throw Error('Unexpected route');
 }};
vm.runInNewContext(fs.readFileSync('supabase/functions/orbit-reminders/index.ts','utf8').replace(/^import webpush.*\n/m,''),ctx);
const request=(key=token,origin)=>new Request('https://test.invalid',{method:'POST',headers:{'x-orbit-reminder-token':key,...(origin?{origin}:{})},body:'{}'});
(async()=>{
 assert.equal((await handler(request(token,'https://evil.invalid'))).status,403);
 assert.equal((await handler(request('b'.repeat(64)))).status,401);assert.equal(accepted,0);
 let r=await handler(request());assert.equal(r.status,200);assert.equal((await r.json()).accepted,1);assert.equal(accepted,1);assert.ok(removed);
 await handler(request());assert.equal(accepted,1);assert.equal(deliveries[0].kind,'checkin');
 claimed=false;endpoint='https://127.0.0.1/admin';await handler(request());assert.equal(accepted,1);
 console.log('PASS: mocked scheduler token/origin checks, owner scope, retention, window scheduling, delivery deduplication, discreet payload, TTL, SSRF host rejection and no redirects. Real Web Push encryption/delivery still needs an iPhone test.');
})().catch(e=>{console.error(e);process.exitCode=1});
