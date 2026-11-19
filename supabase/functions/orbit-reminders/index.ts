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
