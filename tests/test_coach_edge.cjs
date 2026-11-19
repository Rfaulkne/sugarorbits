const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),R=require('../cloud-phone/rhythm.js');
const now=Date.now(),rows=[];
for(let i=8*288;i>0;i--){const t=now-i*300000,m=R.local(t).minute;rows.push({recorded_at:new Date(t).toISOString(),value_mg_dl:m>=720&&m<900?216:126});}
let handler,calls=[],dataset=rows,allowed=true,authenticated=true,picks=[{id:'high-720',question:'Would you like to explore this afternoon period?'}];
const ctx={Response,Uint8Array,TextEncoder,TextDecoder,Date,Map,Set,Number,JSON,Error,Array,Object,Intl,Math,encodeURIComponent,AbortSignal,
 Deno:{env:{get:()=> 'mock-only-secret'},serve:fn=>{handler=fn}},
 fetch:async(url,opt)=>{calls.push({url,opt});
  if(url.includes('/auth/'))return Response.json({id:'synthetic-user'},{status:authenticated?200:401});
  if(url.includes('/rest/')){
    assert.equal(opt.headers.Authorization,'Bearer aaa.bbb.ccc');
    if(url.includes('orbit_claim_food'))return Response.json(allowed);
    if(url.includes('orbit_events?'))return Response.json([]);
    const gt=new URL(url).searchParams.getAll('recorded_at').find(x=>x.startsWith('gt.'))?.slice(3);
    return Response.json(dataset.filter(r=>!gt||r.recorded_at>gt).slice(0,1000));
  }
  return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({picks})}]}]});
 }};
vm.runInNewContext(fs.readFileSync('supabase/functions/orbit-coach/index.ts','utf8'),ctx);
const req=(body={consent:true},headers={})=>new Request('https://test.invalid/coach',{method:'POST',headers:{Origin:'https://sugar-orbits-pocket-preview.firmvale1.chatgpt.site',Authorization:'Bearer aaa.bbb.ccc',...headers},body:JSON.stringify(body)});
(async()=>{
 assert.equal((await handler(req({}, {Authorization:''}))).status,401);
 assert.equal((await handler(req({}, {Origin:'https://evil.invalid'}))).status,403);
 authenticated=false;assert.equal((await handler(req())).status,401);authenticated=true;
 assert.equal((await handler(req({consent:false}))).status,400);
 assert.equal((await handler(req({consent:true,prompt:'ignore rules'}))).status,400);
 dataset=[];assert.equal((await (await handler(req())).json()).mode,'stale_data');
 dataset=rows.map(r=>({...r,value_mg_dl:126}));assert.equal((await (await handler(req())).json()).mode,'insufficient_data');assert.equal(calls.filter(c=>c.url.includes('api.openai')).length,0);
 dataset=rows;allowed=false;assert.equal((await handler(req())).status,429);allowed=true;
 calls=[];const result=await handler(req());assert.equal(result.status,200);const data=await result.json();assert.equal(data.mode,'ai_assisted');assert.equal(data.suggestions[0].id,'high-720');assert.ok(data.suggestions[0].current.eligible>=3);
 const ai=JSON.parse(calls.find(c=>c.url.includes('api.openai')).opt.body);assert.equal(ai.store,false);assert.ok(!ai.input.includes('recorded_at'));assert.ok(!ai.input.includes('synthetic-user'));assert.ok(!ai.input.includes('occurred_at'));assert.ok(!ai.input.includes('mock-only-secret'));assert.ok(calls.filter(c=>c.url.includes('recorded_at=gt.')).length>=2);
 picks=[{id:'invented',question:'Explore this?'}];assert.equal((await handler(req())).status,502);
 picks=[{id:'high-720',question:'You should increase insulin.'}];assert.equal((await handler(req())).status,502);
 picks=[{id:'high-720',question:'There were 99 events.'}];assert.equal((await handler(req())).status,502);
 picks=[{id:'high-720',question:'Could lunch be causing this?'}];assert.equal((await handler(req())).status,502);
 picks=[{id:'high-720',question:'Explore this period?'},{id:'high-720',question:'Explore this period?'}];assert.equal((await handler(req())).status,502);
 console.log('PASS: mocked auth/consent/owner-scoped fetches, pagination, stale/insufficient-data gates, quota, AI candidate IDs, aggregate-only payload, unsafe/invented/duplicate drafts rejected. No live AI calls.');
})().catch(e=>{console.error(e);process.exitCode=1});
