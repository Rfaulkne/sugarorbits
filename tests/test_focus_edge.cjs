const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
let handler,plans=[],calls=[],allowed=true,authenticated=true,draft={question:'context',ideas:['tag']};
const now=Date.now(),rows=[];for(let t=now-17*864e5;t<=now;t+=300000)rows.push({recorded_at:new Date(t).toISOString(),value_mg_dl:126});
const context={window:{},Response,Request,URL,TextEncoder,TextDecoder,Date,Map,Set,Number,JSON,Error,Array,Object,Intl,Math,encodeURIComponent,AbortSignal,crypto:require('node:crypto').webcrypto,
 Deno:{env:{get:n=>n==='SUPABASE_SECRET_KEYS'?'{}':n==='ORBIT_VAPID_PUBLIC_KEY'?'public-key':'mock-secret'},serve:fn=>handler=fn},
 fetch:async(url,opt={})=>{calls.push({url,opt});
  if(url.includes('/auth/'))return Response.json({id:owner},{status:authenticated?200:401});
  if(url.includes('api.openai.com'))return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(draft)}]}]});
  if(url.includes('orbit_claim_food'))return Response.json(allowed);
  if(url.includes('orbit_write_focus')){const p=JSON.parse(opt.body);assert.equal(p.p_owner,owner);if(p.p_revision===0)plans=[{id,plan:p.p_plan,revision:1,expires_at:new Date(now+28*864e5).toISOString()}];else{assert.equal(p.p_id,id);plans[0].plan=p.p_plan;plans[0].revision++;}return Response.json(true);}
  if(url.includes('orbit_focus_plans')){assert.ok(url.includes('user_id=eq.'+owner));if(opt.method==='DELETE'){plans=[];return Response.json([]);}return Response.json(plans);}
  if(url.includes('orbit_glucose?')){const filters=new URL(url).searchParams.getAll('recorded_at'),gte=filters.find(s=>s.startsWith('gte.'))?.slice(4),gt=filters.find(s=>s.startsWith('gt.'))?.slice(3);return Response.json(rows.filter(r=>(!gte||r.recorded_at>=gte)&&(!gt||r.recorded_at>gt)).slice(0,1000));}
  if(url.includes('orbit_events?'))return Response.json([{kind:'stress',occurred_at:new Date(now-864e5).toISOString()}]);
  if(url.includes('orbit_push_devices'))return Response.json([]);
  throw Error('Unexpected route');
 }};
vm.runInNewContext(fs.readFileSync('supabase/functions/orbit-focus/index.ts','utf8'),context);
const req=(body,origin='https://sugar-orbits-pocket-preview.firmvale1.chatgpt.site')=>new Request('https://test.invalid',{method:'POST',headers:{Origin:origin,Authorization:'Bearer aaa.bbb.ccc'},body:JSON.stringify(body)});
(async()=>{
 assert.equal((await handler(req({action:'list'},'https://evil.invalid'))).status,403);
 authenticated=false;assert.equal((await handler(req({action:'list'}))).status,401);authenticated=true;
 assert.equal((await handler(req({action:'start',kind:'high',start:721,habit:'Notice'}))).status,400);
 let result=await handler(req({action:'start',kind:'high',start:720,habit:'private experiment text'}));assert.equal(result.status,200);assert.equal(plans[0].plan.status,'active');assert.equal(plans[0].plan.reminder.enabled,false);
 assert.ok(plans[0].plan.baseline.eligible>=5);
 assert.equal((await handler(req({action:'checkin',id,revision:0,status:'tried',note:''}))).status,409);
 assert.equal((await handler(req({action:'checkin',id,revision:1,status:'tried',note:'private reflection text'}))).status,200);
 assert.equal((await handler(req({action:'review',id:'33333333-3333-4333-8333-333333333333'}))).status,404);
 assert.equal((await handler(req({action:'coach',id,consent:false}))).status,400);
 result=await handler(req({action:'coach',id,consent:true}));assert.equal(result.status,200);const coach=await result.json();assert.equal(coach.mode,'ai_assisted');
 const sent=JSON.parse(calls.find(c=>c.url.includes('api.openai')).opt.body);assert.equal(sent.store,false);for(const text of ['private experiment','private reflection','recorded_at','occurred_at',owner])assert.ok(!sent.input.includes(text));
 draft={question:'take-insulin',ideas:[]};assert.equal((await handler(req({action:'coach',id,consent:true}))).status,502);
 assert.equal((await handler(req({action:'reflect',id,revision:2,worked:'Helpful'}))).status,400);
 assert.equal((await handler(req({action:'subscribe',subscription:{endpoint:'http://127.0.0.1/',keys:{}}}))).status,400);
 allowed=false;assert.equal((await handler(req({action:'coach',id,consent:true}))).status,429);
 console.log('PASS: mocked focus auth, RLS owner scope, start/baseline, check-in, revision conflict, missing focus, aggregate-only AI, invalid output rejection, early reflection and invalid push endpoint rejection.');
})().catch(e=>{console.error(e);process.exitCode=1});
