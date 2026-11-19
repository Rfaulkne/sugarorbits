const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const owner='11111111-1111-4111-8111-111111111111';
const account='22222222-2222-4222-8222-222222222222';
const shareSession='33333333-3333-4333-8333-333333333333';
const env={DEXCOM_OWNER_USER_ID:owner,DEXCOM_SHARE_USERNAME:'mock@example.invalid',DEXCOM_SHARE_PASSWORD:'mock-only-password',DEXCOM_SHARE_REGION:'ous',SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_mock-only'})};
let handler,uid=owner,claim=true,saved=[],sessionFails=false,requests=[],storedRows;
const stamp=Date.now()-5*60000;
const context={Response,Uint8Array,TextEncoder,Date,Map,Number,JSON,Error,Array,encodeURIComponent,AbortSignal,crypto:require('node:crypto').webcrypto,
 Deno:{env:{get:k=>env[k]},serve:fn=>{handler=fn}},
 fetch:async(url,opt)=>{
  requests.push({url,opt});
  if(url.includes('/auth/'))return Response.json({id:uid});
  if(url.includes('/rest/')){
   if(url.includes('orbit_claim'))return Response.json(claim);
   if(url.includes('orbit_store')){storedRows=JSON.parse(opt.body).readings;return Response.json(storedRows.length);}
   if(url.includes('orbit_share_session')&&opt.method==='GET')return Response.json(saved);
   return new Response(null,{status:204});
  }
  assert.ok(url.startsWith('https://shareous1.dexcom.com/'));
  if(url.includes('AuthenticatePublisher'))return Response.json(account);
  if(url.includes('LoginPublisher'))return Response.json(shareSession);
  if(sessionFails){sessionFails=false;return Response.json({Code:'SessionNotValid'},{status:500});}
  return Response.json([{WT:`Date(${stamp})`,DT:'not-used',Value:126,Trend:'Flat'},{WT:`Date(${stamp})`,Value:126,Trend:'Flat'}]);
 }};
vm.runInNewContext(fs.readFileSync('supabase/functions/dexcom-sync/index.ts','utf8'),context);
const req=(auth='Bearer aaa.bbb.ccc',origin='https://sugar-orbits-pocket-preview.firmvale1.chatgpt.site')=>new Request('https://test.invalid/dexcom-sync',{method:'POST',headers:{Authorization:auth,Origin:origin}});
(async()=>{
 assert.equal((await handler(req(''))).status,401);assert.equal(requests.length,0);
 assert.equal((await handler(req(undefined,'https://evil.invalid'))).status,403);
 env.DEXCOM_OWNER_USER_ID='';assert.equal((await handler(req())).status,503);env.DEXCOM_OWNER_USER_ID=owner;
 uid=account;assert.equal((await handler(req())).status,403);assert.equal(requests.some(r=>r.url.includes('dexcom.com')),false);uid=owner;
 claim=false;assert.equal((await handler(req())).status,429);claim=true;
 const result=await handler(req()),data=await result.json();assert.equal(result.status,200);assert.equal(data.received,1);assert.equal(storedRows.length,1);assert.equal(storedRows[0].recorded_at,new Date(stamp).toISOString());assert.equal(storedRows[0].value_mg_dl,126);
 const rpc=requests.find(r=>r.url.includes('orbit_store'));assert.equal(JSON.parse(rpc.opt.body).owner_id,owner);assert.ok(!JSON.stringify(data).includes(env.DEXCOM_SHARE_PASSWORD));
 assert.throws(()=>context.normalize([{WT:'invalid',Value:126}]),/invalid_readings/);
 assert.throws(()=>context.normalize([{WT:`Date(${stamp})`,Value:0}]),/invalid_readings/);
 assert.throws(()=>context.normalize([{WT:`Date(${Date.now()+3600000})`,Value:126}]),/invalid_readings/);
 requests=[];saved=[];
 // Cache fingerprint for the exact configured credentials, then simulate expiry.
 const fingerprint=require('node:crypto').createHash('sha256').update(JSON.stringify([env.DEXCOM_SHARE_USERNAME,env.DEXCOM_SHARE_PASSWORD,env.DEXCOM_SHARE_REGION])).digest('hex');
 saved=[{session_id:shareSession,credential_fingerprint:fingerprint}];sessionFails=true;
 assert.equal((await handler(req())).status,200);assert.equal(requests.filter(r=>r.url.includes('AuthenticatePublisher')).length,1);
 const preflight=await handler(new Request('https://test.invalid/',{method:'OPTIONS',headers:{Origin:'https://sugar-orbits-pocket-preview.firmvale1.chatgpt.site'}}));assert.equal(preflight.status,200);
 console.log('PASS: mocked auth/owner isolation, cooldown, sync/dedup, UTC timestamps, invalid values, session retry and CORS. No live Dexcom or database calls.');
})().catch(error=>{console.error(error);process.exitCode=1});
