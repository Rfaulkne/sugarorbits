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
  const config=()=>({vapid_public_key:Deno.env.get('ORBIT_VAPID_PUBLIC_KEY')||null,reminders_configured:!!(Deno.env.get('ORBIT_VAPID_PRIVATE_KEY')&&Deno.env.get('ORBIT_REMINDER_TOKEN'))});
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
   if(!['high','low','activity'].includes(input.kind)||!Number.isInteger(input.start)||input.start<0||input.start>1260||input.start%180!==0||typeof input.habit!=='string'||!input.habit.trim()||input.habit.length>160)return reply(400,{message:'Choose a window and one short experiment.'});
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
   const allowed=facts.outcome.code==='improved'?['reflect','context']:facts.outcome.code==='mixed'?['mixed','context']:facts.outcome.code==='insufficient'?['coverage','context']:['context','small','today'];
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
