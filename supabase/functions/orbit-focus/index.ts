// Generated single-file dashboard deployment. See PHONE_APP_SETUP.md.
const window={};
/* Deterministic summaries. No AI calls, cause inference or treatment advice. */
(() => {
  const timezone='Europe/Berlin', DAY=864e5;
  const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const local=stamp=>{
    const p=Object.fromEntries(formatter.formatToParts(new Date(stamp)).map(x=>[x.type,x.value]));
    return {date:`${p.year}-${p.month}-${p.day}`,minute:+p.hour*60 + +p.minute};
  };
  const shift=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);
  function samples(rows,now=Date.now()){
    const unique=new Map();
    for(const r of rows){const t=Date.parse(r.recorded_at),v=r.value_mg_dl;if(!Number.isFinite(t)||t>now||!Number.isFinite(v)||v<20||v>600)continue;
      unique.set(Math.floor(t/300000),{t,v:v/18,...local(t)});}
    return [...unique.values()].sort((a,b)=>a.t-b.t);
  }
  const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  function summarize(rows,events=[],now=Date.now()){
    const today=local(now).date,start=shift(today,-7),previousStart=shift(today,-14),all=samples(rows,now);
    const current=all.filter(r=>r.date>=start&&r.date<today),previous=all.filter(r=>r.date>=previousStart&&r.date<start);
    function profile(group){return Array.from({length:48},(_,i)=>{
      const days=new Map();for(const r of group)if(Math.floor(r.minute/30)===i){if(!days.has(r.date))days.set(r.date,[]);days.get(r.date).push(r.v);}
      // >=5 of the usual 6 five-minute samples per local half-hour. Equal day weights.
      // The repeated DST half-hour needs >=9 of its 12 actual slots.
      const eligible=[...days].filter(([d,a])=>a.length>=Math.ceil(expected(d,i*30,i*30+30)*.7)).map(([,a])=>a);
      return {minute:i*30+15,mean:mean(eligible.map(a=>mean(a))),highFraction:mean(eligible.map(a=>a.filter(v=>v>10).length/a.length))||0,lowFraction:mean(eligible.map(a=>a.filter(v=>v<3.9).length/a.length))||0,days:eligible.length};
    });}
    return {today,timezone,clockMinute:local(now).minute,profile:profile(current),previousProfile:profile(previous),current,previous,all,
      events:events.filter(e=>e&&Date.parse(e.occurred_at)>=Date.parse(start+'T00:00:00Z')-DAY&&Date.parse(e.occurred_at)<=now).map(e=>({id:e.id,kind:e.kind,at:e.occurred_at})),
      days:[],coveredDates:new Set(current.map(r=>r.date)).size,
      rangeFraction:current.length?current.filter(r=>r.v>=3.9&&r.v<=10).length/current.length:null};
  }
  const expectedCache=new Map();
  function daySlots(date){
    if(!expectedCache.has(date)){const noon=Date.parse(date+'T12:00:00Z'),slots=[];
      for(let t=noon-26*3600e3;t<noon+26*3600e3;t+=300000){const p=local(t);if(p.date===date)slots.push({minute:p.minute,t});}
      expectedCache.set(date,slots);}
    return expectedCache.get(date);
  }
  function expected(date,start,end){return daySlots(date).filter(s=>s.minute>=start&&s.minute<end).length;}
  function metrics(group,start,end,after=-Infinity,now=Date.now()){
    const days=new Map();for(const r of group)if(r.minute>=start&&r.minute<end){if(!days.has(r.date))days.set(r.date,[]);days.get(r.date).push(r);}
    let eligible=0,affectedHigh=0,affectedLow=0,high=0,low=0,range=0;
    for(const [date,a] of days){
      // Exclude a window containing any pre-experiment samples.
      const slots=daySlots(date).filter(s=>s.minute>=start&&s.minute<end);
      if(!slots.length||slots[0].t<after||slots[slots.length-1].t+300000>now||a.length<Math.ceil(slots.length*.7))continue;
      eligible++;const values=a.map(r=>r.v);const h=values.filter(v=>v>10).length/values.length,l=values.filter(v=>v<3.9).length/values.length;
      high+=h;low+=l;range+=1-h-l;
      const episode=predicate=>a.some((r,i)=>i>=2&&predicate(r.v)&&predicate(a[i-1].v)&&predicate(a[i-2].v)&&r.t-a[i-1].t<=6*60000&&a[i-1].t-a[i-2].t<=6*60000);
      affectedHigh+=+episode(v=>v>10);affectedLow+=+episode(v=>v<3.9);
    }
    return {eligible,high:eligible?high/eligible:null,low:eligible?low/eligible:null,range:eligible?range/eligible:null,affectedHigh,affectedLow};
  }
  function activityMetrics(group,events,from,to){
    const tags=events.filter(e=>e.kind==='activity').map(e=>Date.parse(e.at||e.occurred_at)).filter(t=>t>=from&&t+2*3600e3<=to).sort((a,b)=>a-b);
    let eligible=0,range=0,low=0,high=0,last=-Infinity;
    for(const t of tags){if(t<last)continue;last=t+2*3600e3;const values=group.filter(r=>r.t>=t&&r.t<last);if(values.length<17)continue;
      eligible++;range+=values.filter(r=>r.v>=3.9&&r.v<=10).length/values.length;high+=values.filter(r=>r.v>10).length/values.length;low+=values.filter(r=>r.v<3.9).length/values.length;}
    return {eligible,range:eligible?range/eligible:null,high:eligible?high/eligible:null,low:eligible?low/eligible:null};
  }
  function tagMetrics(group,events,kind,from,to){
    const tags=events.filter(e=>e.kind===kind).map(e=>Date.parse(e.at||e.occurred_at)).filter(t=>Number.isFinite(t)&&t>=from&&t+7200000<=to).sort((a,b)=>a-b);
    const windows=[];let last=-Infinity;
    for(const t of tags){if(t<last)continue;const bins=new Map();for(const p of group)if(p.t>=t&&p.t<t+7200000)bins.set(Math.floor((p.t-t)/300000),p);
      if(bins.size<17)continue;last=t+7200000;const a=[...bins.values()].sort((a,b)=>a.t-b.t),v=a.map(p=>p.v);
      const episode=pred=>a.some((p,i)=>i>=2&&pred(p.v)&&pred(a[i-1].v)&&pred(a[i-2].v)&&p.t-a[i-1].t<=360000&&a[i-1].t-a[i-2].t<=360000);
      windows.push({date:local(t).date,high:v.filter(x=>x>10).length/v.length,low:v.filter(x=>x<3.9).length/v.length,range:v.filter(x=>x>=3.9&&x<=10).length/v.length,above:episode(x=>x>10),below:episode(x=>x<3.9)});
    }
    return {eligible:windows.length,distinctDays:new Set(windows.map(w=>w.date)).size,high:mean(windows.map(w=>w.high)),low:mean(windows.map(w=>w.low)),range:mean(windows.map(w=>w.range)),affectedHigh:windows.filter(w=>w.above).length,affectedLow:windows.filter(w=>w.below).length};
  }
  const api={local,shift,samples,summarize,metrics,activityMetrics,tagMetrics,expected};
  if(typeof module!=='undefined')module.exports=api;else window.OrbitRhythm=api;
})();

/* Shared, deterministic focus rules. No AI or treatment decisions. */
((root)=>{
  const DAY=86400000;
  function evaluate(kind,before,after,elapsed){
    if(elapsed<7*DAY)return {code:'observing',label:'Still observing'};
    if(!before||!after||before.eligible<5||after.eligible<5)return {code:'insufficient',label:'More covered windows needed'};
    if(['activity','stress'].includes(kind)&&(before.distinctDays<3||after.distinctDays<3||!Number.isInteger(before.distinctDays)||!Number.isInteger(after.distinctDays)))return {code:'insufficient',label:'More distinct tagged days needed'};
    const target=kind==='low'?'low':kind==='high'?'high':'range';
    const improved=target==='range'?after.range-before.range>=.1:before[target]-after[target]>=.05&&after[target]<=before[target]*.5;
    const tradeoff=after.low>before.low+.01||after.high>before.high+.05;
    if(improved&&!tradeoff)return {code:'improved',label:'A clearer improvement in the recorded window'};
    if(tradeoff)return {code:'mixed',label:'A mixed picture—review highs and lows together'};
    if(['activity','stress'].includes(kind)&&before.range>=.7&&after.range>=before.range-.03)return {code:'maintained',label:'In-range coverage broadly maintained'};
    return {code:'similar',label:'No clear improvement in the recorded window yet'};
  }
  function context(samples,events,start,end,from,to,R){
    const out={activity:0,stress:0,other:0};
    for(const e of events){const t=Date.parse(e.occurred_at);if(t<from||t>=to||!Number.isFinite(t)||!(e.kind in out))continue;
      const m=R.local(t).minute;if(m>=start&&m<end)out[e.kind]++;}
    return out;
  }
  function measures(plan,rows,events,R,now=Date.now()){
    const samples=R.samples(rows,now),start=plan.started,end=Math.min(now,start+7*DAY);
    const tagged=['activity','stress'].includes(plan.kind);
    // Server-created aggregate baseline survives pruning of the newest-20 raw tags.
    const before=tagged?(plan.baseline||R.tagMetrics(samples,events,plan.kind,start-7*DAY,start)):R.metrics(samples,plan.start,plan.start+180,start-7*DAY,start);
    const after=tagged?R.tagMetrics(samples,events,plan.kind,start,end):R.metrics(samples,plan.start,plan.start+180,start,end);
    return {before,after,outcome:evaluate(plan.kind,before,after,now-start),tags:context(samples,events,tagged?0:plan.start,tagged?1440:plan.start+180,start,end,R),latest:samples.at(-1)?.t||null};
  }
  function due(plan,now,R){
    const r=plan.reminder;if(!r?.enabled||!['active','maintaining'].includes(plan.status)||now>=plan.started+28*DAY||now<plan.started)return null;
    const {date,minute}=R.local(now),at=((['activity','stress'].includes(plan.kind)?r.minute:plan.start)-(r.lead||0)+1440)%1440;
    const quiet=r.quiet_start===r.quiet_end?false:r.quiet_start<r.quiet_end?minute>=r.quiet_start&&minute<r.quiet_end:minute>=r.quiet_start||minute<r.quiet_end;
    if(quiet||minute<at||minute>=at+15)return null;
    const elapsed=Math.floor((now-plan.started)/DAY),type=plan.status==='maintaining'?'keep':elapsed>=7?'review':'checkin';
    if(type==='checkin'&&plan.checkins?.[date])return null;
    if(type==='keep'&&r.frequency===7&&new Date(date+'T12:00Z').getUTCDay()!==new Date(R.local(Date.parse(plan.maintained_at)).date+'T12:00Z').getUTCDay())return null;
    return {date,key:type==='review'?'review':date,type};
  }
  const api={evaluate,context,measures,due};if(typeof module!=='undefined')module.exports=api;root.OrbitFocusCore=api;
})(typeof window!=='undefined'?window:globalThis);

// Bundled with rhythm.js and focus-core.js. JWT verification stays ON.
const R=window.OrbitRhythm,F=window.OrbitFocusCore;
const PROJECT='https://hinknpgmmhkqphsgvuek.supabase.co',KEY='sb_publishable_M-0fIrNtiOrSOoDfpjh2TA_dUvGCRx_';
const ORIGIN='https://sugar-orbits-pocket-preview.firmvale1.chatgpt.site';
const headers={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store',Vary:'Origin'};
const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s);
const safeSub=s=>{try{const u=new URL(s.endpoint);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&['web.push.apple.com','fcm.googleapis.com','updates.push.services.mozilla.com'].includes(u.hostname)&&s.endpoint.length<2048&&/^[A-Za-z0-9_-]{87}$/.test(s.keys?.p256dh)&&/^[A-Za-z0-9_-]{22}$/.test(s.keys?.auth);}catch{return false;}};
const prompts={context:'What tends to be happening around this time?',small:'What small observation would feel realistic for you?',today:'Did your plan fit today, or did something make it harder?',mixed:'Would you like to look at highs and lows together before changing your plan?',reflect:'What felt useful, and what would you like to keep?',coverage:'Would you prefer a few more covered days before judging this?'};
const experiments={tag:'Tag the context when this window comes around.',routine:'Notice whether your usual routine differs on these days.',note:'Keep one short note about what felt practical.',team:'Bring this recurring window to your diabetes team.'};
async function history(auth,from,now){
 const get=async path=>{const r=await fetch(PROJECT+'/rest/v1/'+path,{headers:{apikey:KEY,Authorization:auth},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('storage');return r.json();};
 let rows=[],cursor=null,complete=false;
 for(let p=0;p<20;p++){const batch=await get('orbit_glucose?select=recorded_at,value_mg_dl&order=recorded_at.asc&limit=1000&recorded_at=gte.'+encodeURIComponent(new Date(from).toISOString())+(cursor?'&recorded_at=gt.'+encodeURIComponent(cursor):''));if(!Array.isArray(batch))throw Error('storage');if(!batch.length){complete=true;break;}const next=batch.at(-1).recorded_at;if(!Number.isFinite(Date.parse(next))||cursor&&next<=cursor)throw Error('storage');rows.push(...batch);cursor=next;}
 if(!complete)throw Error('storage');
 const events=await get('orbit_events?select=kind,occurred_at&order=occurred_at.desc&limit=20');if(!Array.isArray(events))throw Error('storage');return {rows,events};
}
async function handler(req){
 if(req.headers.get('origin')!==ORIGIN)return reply(403,{message:'Origin not allowed.'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{message:'Use POST.'});
 const auth=req.headers.get('authorization')||'';if(!/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(auth))return reply(401,{message:'Sign in first.'});
 try{
  const u=await fetch(PROJECT+'/auth/v1/user',{headers:{apikey:KEY,Authorization:auth},signal:AbortSignal.timeout(10000)});if(!u.ok)return reply(401,{message:'Please sign in again.'});const user=await u.json();if(!uuid(user.id)||user.is_anonymous)return reply(401,{message:'A personal account is required.'});
  const text=await req.text();if(text.length>10000)return reply(400,{message:'Request too large.'});let input;try{input=JSON.parse(text);}catch{return reply(400,{message:'Invalid request.'});}
  let service;try{service=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');}catch{}
  if(!service)return reply(503,{message:'Server configuration incomplete.'});
  const db=async(path,method='GET',body=null,privateUser=false)=>{const r=await fetch(PROJECT+'/rest/v1/'+path,{method,headers:{apikey:privateUser?KEY:service,Authorization:privateUser?auth:'Bearer '+service,'Content-Type':'application/json',Prefer:'return=representation'},...(body===null?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('storage');return r.status===204?null:r.json();};
  const now=Date.now(),owner='user_id=eq.'+user.id;
  const list=async()=>db('orbit_focus_plans?select=id,plan,revision,expires_at&'+owner+'&expires_at=gt.'+encodeURIComponent(new Date(now).toISOString())+'&order=created_at.desc&limit=5','GET',null,true);
  const config=()=>({vapid_public_key:Deno.env.get('ORBIT_VAPID_PUBLIC_KEY')||null,tag_focus_version:2,reminders_configured:!!(Deno.env.get('ORBIT_VAPID_PRIVATE_KEY')&&Deno.env.get('ORBIT_REMINDER_TOKEN'))});
  if(input.action==='list')return reply(200,{plans:await list(),...config()});
  if(input.action==='subscribe'){
   if(!config().reminders_configured||!safeSub(input.subscription))return reply(400,{message:'Push is not configured or this browser subscription is unsupported.'});
   const s=input.subscription,existing=await db('orbit_push_devices?select=id,user_id&endpoint=eq.'+encodeURIComponent(s.endpoint));
   if(existing.length&&existing[0].user_id!==user.id)return reply(409,{message:'Disable reminders in the previous account on this device first.'});
   const devices=await db('orbit_push_devices?select=id&'+owner);if(!existing.length&&devices.length>=3)return reply(409,{message:'Three devices are already registered. Remove one before adding another.'});
   const device={subscription:{endpoint:s.endpoint,keys:{p256dh:s.keys.p256dh,auth:s.keys.auth}},updated_at:new Date(now).toISOString()};
   if(existing.length)await db('orbit_push_devices?id=eq.'+existing[0].id+'&'+owner,'PATCH',device);
   else await db('orbit_push_devices','POST',{...device,user_id:user.id,endpoint:s.endpoint});
   return reply(200,{ok:true});
  }
  if(input.action==='unsubscribe'){if(typeof input.endpoint!=='string'||input.endpoint.length>2048)return reply(400,{message:'Invalid device.'});await db('orbit_push_devices?'+owner+'&endpoint=eq.'+encodeURIComponent(input.endpoint),'DELETE');return reply(200,{ok:true});}
  const plans=await list();let record=input.id?plans.find(p=>p.id===input.id):null;
  if(input.action==='start'){
   if(plans.some(p=>p.plan.status==='active'))return reply(409,{message:'Refresh your active focus before starting another.'});
   if(!['high','low','activity','stress'].includes(input.kind)||!Number.isInteger(input.start)||input.start<0||input.start>1260||input.start%180!==0||typeof input.habit!=='string'||!input.habit.trim()||input.habit.length>160)return reply(400,{message:'Choose a window and one short experiment.'});
   const plan={started:now,kind:input.kind,start:input.start,habit:input.habit.trim(),status:'active',checkins:{},reminder:{enabled:false,lead:15,minute:1080,quiet_start:1320,quiet_end:480,frequency:7}};
   const h=await history(auth,now-8*864e5,now);plan.baseline=F.measures(plan,h.rows,h.events,R,now).before;
   const id=crypto.randomUUID();await db('rpc/orbit_write_focus','POST',{p_owner:user.id,p_id:id,p_revision:0,p_plan:plan});return reply(200,{plans:await list()});
  }
  if(!record)return reply(404,{message:'This focus is missing or expired. Refresh the app.'});
  const plan=record.plan;
  if(input.action==='coach'||input.action==='review'){
   const h=await history(auth,plan.started-8*864e5,now),facts=F.measures(plan,h.rows,h.events,R,now);
   if(input.action==='review')return reply(200,{facts});
   if(input.consent!==true)return reply(400,{message:'Use Ask coach to share calculated summaries.'});
   if(!facts.latest||now-facts.latest>864e5)return reply(200,{facts,question:prompts.coverage,ideas:[],mode:'stale_data'});
   const quota=await db('rpc/orbit_claim_food_request','POST',{},true);if(quota!==true)return reply(429,{message:'Wait ten seconds. Focus and Food share twenty AI requests per day.'});
   const api=Deno.env.get('OPENAI_API_KEY');if(!api)return reply(503,{message:'AI is not configured.'});
   const allowed=['improved','maintained'].includes(facts.outcome.code)?['reflect','context']:facts.outcome.code==='mixed'?['mixed','context']:facts.outcome.code==='insufficient'?['coverage','context']:['context','small','today'];
   const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+api,'Content-Type':'application/json'},signal:AbortSignal.timeout(40000),body:JSON.stringify({model:'gpt-4.1-mini',store:false,max_output_tokens:300,instructions:'Choose one suitable gentle reflection question and up to two observation ideas from the supplied identifiers. Context tags are incomplete and are associations, not causes. Do not infer meals, exercise intensity, stress causes, treatment changes or that a pattern is solved. No free text: select identifiers only. Favor low effort. All statistics are computed, not yours to change.',input:JSON.stringify({kind:plan.kind,phase:facts.outcome.code,before:facts.before,after:facts.after,tags:facts.tags,checkins:Object.values(plan.checkins||{}).reduce((a,c)=>(a[c.status]=(a[c.status]||0)+1,a),{}),allowed_questions:allowed,question_library:prompts,idea_library:experiments}),text:{format:{type:'json_schema',name:'focus_reflection',strict:true,schema:{type:'object',additionalProperties:false,properties:{question:{type:'string',enum:allowed},ideas:{type:'array',items:{type:'string',enum:Object.keys(experiments)}}},required:['question','ideas']}}}})});
   if(!response.ok)throw Error('ai');const output=await response.json();if(output.status!=='completed')throw Error('ai');const draft=JSON.parse((output.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join(''));
   if(!allowed.includes(draft.question)||!Array.isArray(draft.ideas)||draft.ideas.length>2||draft.ideas.some(x=>!experiments[x])||new Set(draft.ideas).size!==draft.ideas.length)throw Error('ai');
   return reply(200,{facts,question:prompts[draft.question],ideas:draft.ideas.map(id=>experiments[id]),mode:'ai_assisted'});
  }
  if(input.action==='delete'){await db('orbit_focus_plans?id=eq.'+record.id+'&'+owner,'DELETE');return reply(200,{plans:await list()});}
  if(input.action==='checkin'){
   if(!['tried','not-today','skip','note'].includes(input.status)||typeof input.note!=='string'||input.note.length>240)return reply(400,{message:'Invalid check-in.'});
   plan.checkins=plan.checkins||{};plan.checkins[R.local(now).date]={status:input.status,note:input.note};
  }else if(input.action==='reminder'){
   const r=input.reminder;
   if(!r||typeof r.enabled!=='boolean'||![0,15,30].includes(r.lead)||![1,7].includes(r.frequency)||!['minute','quiet_start','quiet_end'].every(k=>Number.isInteger(r[k])&&r[k]>=0&&r[k]<1440))return reply(400,{message:'Invalid reminder preferences.'});
   plan.reminder={enabled:r.enabled,lead:r.lead,minute:r.minute,quiet_start:r.quiet_start,quiet_end:r.quiet_end,frequency:r.frequency};
  }else if(input.action==='reflect'){
   if(typeof input.worked!=='string'||!input.worked.trim()||input.worked.length>240)return reply(400,{message:'Write one thing you found useful.'});
   if(now-plan.started<7*864e5)return reply(400,{message:'Your seven-day review is not ready yet.'});
   const h=await history(auth,plan.started-8*864e5,now),facts=F.measures(plan,h.rows,h.events,R,now);
   plan.reflection={worked:input.worked.trim(),outcome:facts.outcome.code,at:new Date(now).toISOString()};plan.status='maintaining';plan.maintained_at=new Date(now).toISOString();
   // Keep reminders off until the user explicitly opts into maintenance.
   plan.reminder.enabled=false;
  }else if(input.action==='finish'){plan.status='completed';plan.reminder.enabled=false;}
  else return reply(400,{message:'Unknown action.'});
  if(input.revision!==record.revision)return reply(409,{message:'This focus changed on another device. Refresh before saving.'});
  const saved=await db('rpc/orbit_write_focus','POST',{p_owner:user.id,p_id:record.id,p_revision:record.revision,p_plan:plan});if(saved!==true)return reply(409,{message:'This focus changed. Refresh before saving.'});
  return reply(200,{plans:await list()});
 }catch{return reply(502,{message:'The cloud focus request could not be completed. Refresh before retrying a save. Check that the new SQL and function are deployed.'});}
}
Deno.serve(handler);
