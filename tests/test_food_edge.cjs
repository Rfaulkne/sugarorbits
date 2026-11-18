const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const origin='https://sugar-orbits-pocket-preview.firmvale1.chatgpt.site';
let handler, quota=true, auth=true, requests=[];
const goodDraft={foods:['rice'],needs_more_info:false,question:'',carbs_low_g:35,carbs_high_g:55,assumptions:['Cooked rice; portion supplied by user.']};
const context={Response,Uint8Array,TextDecoder,JSON,AbortSignal,Number,Error,
  Deno:{env:{get:()=> 'mock-only-secret'},serve:fn=>{handler=fn}},
  fetch:async(url,options)=>{
    requests.push({url,options});
    if(url.includes('/auth/'))return Response.json({id:'mock-user'},{status:auth?200:401});
    if(url.includes('/rpc/'))return Response.json(quota);
    return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(goodDraft)}]}]});
  }};
vm.runInNewContext(fs.readFileSync('supabase/functions/food-genie/index.ts','utf8'),context);
const req=(data,headers={})=>new Request('https://test.invalid/food-genie',{method:'POST',headers:{Origin:origin,Authorization:'Bearer aaa.bbb.ccc',...headers},body:JSON.stringify(data)});
(async()=>{
 assert.equal((await handler(req({},{Origin:'https://evil.invalid'}))).status,403);
 assert.equal((await handler(req({},{Authorization:''}))).status,401);
 auth=false;assert.equal((await handler(req({consent:true}))).status,401);auth=true;
 assert.equal((await handler(req({mode:'identify'}))).status,400);
 assert.equal((await handler(req({mode:'identify',consent:true,image:'https://external.invalid/photo'}))).status,400);
 quota=false;assert.equal((await handler(req({mode:'estimate',consent:true,foods:'rice',portion:'150g cooked'}))).status,429);
 assert.equal(requests.filter(r=>r.url.includes('openai')).length,0);quota=true;
 const result=await handler(req({mode:'estimate',consent:true,foods:'rice',portion:'150g cooked'}));
 assert.equal(result.status,200);assert.equal((await result.json()).carbs_low_g,35);
 const call=requests.find(r=>r.url.includes('openai'));assert.equal(JSON.parse(call.options.body).store,false);
 const identified=await handler(req({mode:'identify',consent:true,image:'data:image/jpeg;base64,/9j/AA=='}));
 assert.equal((await identified.json()).carbs_low_g,null);
 goodDraft.carbs_high_g=20;
 assert.equal((await handler(req({mode:'estimate',consent:true,foods:'rice',portion:'150g'}))).status,502);
 console.log('PASS: 9 mocked checks: origin, JWT requirement, auth, consent, image URL rejection, quota, estimate, identify/null carbs, invalid range. No live API calls.');
})().catch(e=>{console.error(e);process.exitCode=1});
