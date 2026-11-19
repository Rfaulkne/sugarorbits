// Bundled with the same deterministic summaries used by the phone.
// Deploy index.ts, not this source fragment. Keep JWT verification enabled.
const R=window.OrbitRhythm;
const ORIGIN='https://sugar-orbits-pocket-preview.firmvale1.chatgpt.site';
const PROJECT='https://hinknpgmmhkqphsgvuek.supabase.co';
const PUBLIC_KEY='sb_publishable_M-0fIrNtiOrSOoDfpjh2TA_dUvGCRx_';
const headers={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store',Vary:'Origin'};
const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
async function readBody(req){
  const reader=req.body?.getReader();if(!reader)throw new Error('body');const chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();throw new Error('body');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
function candidatesFor(rows,events,now=Date.now()){
  const state=R.summarize(rows,[],now),out=[];
  const compact=m=>({eligible:m.eligible,above:m.high,below:m.low,in_range:m.range,affected_high_days:m.affectedHigh??null,affected_low_days:m.affectedLow??null});
  for(let start=0;start<1440;start+=180){const current=R.metrics(state.current,start,start+180,-Infinity,now),previous=R.metrics(state.previous,start,start+180,-Infinity,now);
    if(current.eligible<3)continue;
    for(const kind of ['high','low']){const affected=kind==='high'?current.affectedHigh:current.affectedLow;
      if(affected<3||affected/current.eligible<.5)continue;
      out.push({id:kind+'-'+start,kind,start,end:start+180,unit:'covered days',current:compact(current),previous:compact(previous),preliminary:current.eligible<5});
    }
  }
  const tags=events.filter(e=>e.kind==='activity');
  // Activity associations are deliberately limited to the recorded tag windows.
  const currentActivity=R.activityMetrics(state.all,tags,now-7*864e5,now),previousActivity=R.activityMetrics(state.all,tags,now-14*864e5,now-7*864e5);
  if(currentActivity.eligible>=3&&currentActivity.high+currentActivity.low>=.05)
    out.push({id:'activity',kind:'activity',start:0,end:1440,unit:'covered tagged windows',current:compact(currentActivity),previous:compact(previousActivity),preliminary:currentActivity.eligible<5});
  return {state,candidates:out};
}
async function handler(req){
  if(req.headers.get('origin')!==ORIGIN)return reply(403,{message:'Origin not allowed.'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply(405,{message:'Use POST.'});
  const auth=req.headers.get('authorization')||'';
  if(!/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(auth))return reply(401,{message:'Sign in first.'});
  const apiKey=Deno.env.get('OPENAI_API_KEY');if(!apiKey)return reply(503,{message:'AI has not been configured.'});
  try{
    const userResponse=await fetch(PROJECT+'/auth/v1/user',{headers:{apikey:PUBLIC_KEY,Authorization:auth},signal:AbortSignal.timeout(10000)});
    if(!userResponse.ok)return reply(401,{message:'Please sign in again.'});
    const user=await userResponse.json();if(!user.id||user.is_anonymous)return reply(401,{message:'A personal account is required.'});
    let input;try{input=await readBody(req);}catch{return reply(400,{message:'Invalid request.'});}
    if(input.consent!==true)return reply(400,{message:'Confirm sharing aggregate pattern summaries with OpenAI for this request.'});
    // No client-provided patterns, habits, notes or prompts are accepted.
    if(Object.keys(input).some(k=>k!=='consent'))return reply(400,{message:'Only the consent flag is accepted.'});
    const get=async path=>{const result=await fetch(PROJECT+'/rest/v1/'+path,{headers:{apikey:PUBLIC_KEY,Authorization:auth},signal:AbortSignal.timeout(10000)});if(!result.ok)throw new Error('storage');return result.json();};
    const now=Date.now(),cutoff=new Date(now-16*864e5).toISOString();let rows=[],cursor=null,complete=false;
    for(let page=0;page<20;page++){
      const batch=await get('orbit_glucose?select=recorded_at,value_mg_dl&order=recorded_at.asc&limit=1000&recorded_at=gte.'+encodeURIComponent(cutoff)+(cursor?'&recorded_at=gt.'+encodeURIComponent(cursor):''));
      if(!Array.isArray(batch))throw new Error('storage');if(!batch.length){complete=true;break;}
      const next=batch[batch.length-1].recorded_at;if(!Number.isFinite(Date.parse(next))||(cursor&&next<=cursor))throw new Error('storage');rows.push(...batch);cursor=next;
    }
    if(!complete)throw new Error('storage');
    const events=await get('orbit_events?select=kind,occurred_at&order=occurred_at.desc&limit=20');if(!Array.isArray(events))throw new Error('storage');
    const {state,candidates}=candidatesFor(rows,events,now);
    const latest=state.all[state.all.length-1]?.t;
    if(!latest||now-latest>864e5)return reply(200,{mode:'stale_data',suggestions:[],message:'Recent readings are missing or over a day old. Check collection before asking the coach.'});
    if(!candidates.length)return reply(200,{mode:'insufficient_data',suggestions:[],message:'No period currently meets the minimum of three affected, adequately covered days or qualifying activity windows. No AI request was made.'});
    const quota=await fetch(PROJECT+'/rest/v1/rpc/orbit_claim_food_request',{method:'POST',headers:{apikey:PUBLIC_KEY,Authorization:auth,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
    if(!quota.ok)throw new Error('quota');if(await quota.json()!==true)return reply(429,{message:'Wait ten seconds between AI requests. Food Genie and Focus share the twenty-request daily test limit.'});
    const schema={type:'object',additionalProperties:false,properties:{picks:{type:'array',items:{type:'object',additionalProperties:false,properties:{id:{type:'string',enum:candidates.map(c=>c.id)},question:{type:'string'}},required:['id','question']}}},required:['picks']};
    const result=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},signal:AbortSignal.timeout(40000),body:JSON.stringify({
      model:'gpt-4.1-mini',store:false,max_output_tokens:700,
      instructions:'Help a person choose one observational glucose-pattern focus. Select one to three DISTINCT IDs only from the supplied calculated candidates, ordered for an understandable, low-burden choice. Prefer adequate coverage, avoid redundant overlapping choices and acknowledge preliminary data. For each, write ONE short gentle question inviting curiosity, not a prescribed habit or action. Associations, never causes. No insulin, medication, doses, pump settings, treatment, diagnoses, reassurance or advice about managing glucose. No numbers or statistics in your question: the app separately displays verified facts. Do not state that one period improved, worsened, is safe or is resolved. No inferred meals, sleep, stress or gym visits: those contexts were not measured. Refer only to clock periods or explicitly tagged activity. Do not invent any pattern or explanation. Return only the requested schema.',
      input:JSON.stringify({timezone:'Europe/Berlin',period:'seven completed days; preceding seven days for reference',activity_definition:'two hours after a logged activity tag; not all exercise is tagged',candidates}),text:{format:{type:'json_schema',name:'focus_choices',strict:true,schema}}
    })});
    if(!result.ok)return reply(502,{message:'AI suggestions are unavailable. Check API credit/model access; no automatic retry was made.'});
    const output=await result.json();if(output.status!=='completed')throw new Error('draft');
    let draft;try{draft=JSON.parse((output.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join(''));}catch{throw new Error('draft');}
    if(!Array.isArray(draft.picks)||draft.picks.length<1||draft.picks.length>3)throw new Error('draft');
    const used=new Set(),suggestions=[];
    for(const pick of draft.picks){const candidate=candidates.find(c=>c.id===pick.id);
      if(!candidate||used.has(pick.id)||typeof pick.question!=='string'||pick.question.length>240||!pick.question.trim())throw new Error('draft');
      // Additional fail-closed guard; not a clinically validated safety classifier.
      if(/\d|insulin|basal|bolus|dos(e|ing|age)|pump|medicat|treat|diagnos|caus|because|due to|led to|lead to|result of|improv|worsen|resolv|meal|lunch|dinner|breakfast|gym|workout|stress|\bsafe\b|\bshould\b|\bmust\b/i.test(pick.question))throw new Error('draft');
      used.add(pick.id);suggestions.push({...candidate,question:pick.question});
    }
    return reply(200,{mode:'ai_assisted',suggestions,generated_at:new Date(now).toISOString(),message:'Calculated observations, AI-assisted choices. You decide what to explore; no causal or treatment conclusions.'});
  }catch(error){
    const messages={storage:'Could not load a complete private data window. No AI suggestions generated.',quota:'The shared AI request-limit setup needs checking.',draft:'The AI draft could not be validated and was discarded. No focus was selected.'};
    return reply(502,{message:messages[error.message]||'Could not complete the AI request. No automatic retry was made.'});
  }
}
Deno.serve(handler);
