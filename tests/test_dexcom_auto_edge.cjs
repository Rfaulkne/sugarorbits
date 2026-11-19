const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const owner='11111111-1111-4111-8111-111111111111',account='22222222-2222-4222-8222-222222222222',session='33333333-3333-4333-8333-333333333333';
const env={DEXCOM_OWNER_USER_ID:owner,DEXCOM_SYNC_TOKEN:'a'.repeat(64),DEXCOM_SHARE_USERNAME:'mock-only',DEXCOM_SHARE_PASSWORD:'mock-password',DEXCOM_SHARE_REGION:'ous',SUPABASE_SECRET_KEYS:'{"default":"sb_secret_mock"}'};
let handler,requests=[],claim=true;
const ctx={Response,Uint8Array,TextEncoder,Date,Map,Number,JSON,Error,Array,encodeURIComponent,AbortSignal,crypto:require('node:crypto').webcrypto,
 Deno:{env:{get:k=>env[k]},serve:fn=>{handler=fn}},fetch:async(url,opt)=>{
  requests.push({url,opt});assert.ok(!url.includes('/auth/'),'Scheduled collection must not need a user JWT');
  if(url.includes('orbit_claim'))return Response.json(claim);
  if(url.includes('orbit_store')){assert.equal(JSON.parse(opt.body).owner_id,owner);return Response.json(1);}
  if(url.includes('/rest/'))return opt.method==='GET'?Response.json([]):new Response(null,{status:204});
  if(url.includes('AuthenticatePublisher'))return Response.json(account);
  if(url.includes('LoginPublisher'))return Response.json(session);
  return Response.json([{WT:`Date(${Date.now()-60000})`,Value:126,Trend:'Flat'}]);
 }};
vm.runInNewContext(fs.readFileSync('supabase/functions/dexcom-auto-sync/index.ts','utf8'),ctx);
const req=(headers={})=>new Request('https://test.invalid/',{method:'POST',headers,body:JSON.stringify({owner_id:account})});
(async()=>{
 assert.equal((await handler(req())).status,401);
 assert.equal((await handler(req({apikey:'public-only'}))).status,401);
 assert.equal((await handler(req({Authorization:'Bearer aaa.bbb.ccc'}))).status,401);
 assert.equal((await handler(req({'x-orbit-sync-token':'b'.repeat(64)}))).status,401);
 assert.equal((await handler(req({'x-orbit-sync-token':env.DEXCOM_SYNC_TOKEN,Origin:'https://sugar-orbits-pocket-preview.firmvale1.chatgpt.site'}))).status,403);
 assert.equal(requests.length,0);
 const valid={'x-orbit-sync-token':env.DEXCOM_SYNC_TOKEN};
 env.DEXCOM_SYNC_TOKEN='';assert.equal((await handler(req(valid))).status,503);env.DEXCOM_SYNC_TOKEN='a'.repeat(64);
 env.DEXCOM_OWNER_USER_ID='';assert.equal((await handler(req(valid))).status,503);env.DEXCOM_OWNER_USER_ID=owner;
 claim=false;assert.equal((await handler(req(valid))).status,429);assert.ok(!requests.some(x=>x.url.includes('dexcom.com')));claim=true;
 const result=await handler(req(valid));assert.equal(result.status,200);const data=await result.json();assert.equal(data.received,1);
 assert.ok(!JSON.stringify(data).includes(env.DEXCOM_SYNC_TOKEN));assert.ok(!JSON.stringify(data).includes(env.DEXCOM_SHARE_PASSWORD));
 assert.equal(requests.filter(x=>x.url.includes('orbit_claim')).at(-1).opt.headers.apikey,'sb_secret_mock');
 console.log('PASS: scheduler token required; anonymous/public-key/JWT/wrong-token/browser denied; unset config denied; owner injection ignored; cooldown enforced; valid server sync succeeds. No live requests.');
})().catch(error=>{console.error(error);process.exitCode=1});
