// Separate scheduler-only function. Platform JWT verification must be OFF here.
// Authentication is enforced by the scoped 256-bit DEXCOM_SYNC_TOKEN below.
// Do not alter the working manual dexcom-sync function or its JWT settings.
// No request body, client-selected owner, raw errors, application logs, or AI calls.
const ORIGIN='https://sugar-orbits-pocket-preview.firmvale1.chatgpt.site';
const PROJECT='https://hinknpgmmhkqphsgvuek.supabase.co';
const PUBLIC_KEY='sb_publishable_M-0fIrNtiOrSOoDfpjh2TA_dUvGCRx_';
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s)&&s!=='00000000-0000-0000-0000-000000000000';
const response=(status,data)=>new Response(JSON.stringify(data),{status,headers:{
  'Access-Control-Allow-Origin':ORIGIN,'Vary':'Origin','Content-Type':'application/json','Cache-Control':'no-store',
  'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'
}});
function normalize(records,now=Date.now()){
  if(!Array.isArray(records)||records.length>288)throw new Error('invalid_readings');
  const rows=new Map();
  for(const item of records){
    // WT is UTC wall time. DT is local display time and must not set the archive timestamp.
    const match=typeof item.WT==='string'?item.WT.match(/^\/?Date\((-?\d+)(?:[+-]\d{4})?\)\/?$/):null;
    const stamp=match?Number(match[1]):NaN;
    if(!Number.isFinite(stamp)||stamp<now-25*3600e3||stamp>now+5*60000||!Number.isInteger(item.Value)||item.Value<20||item.Value>600)
      throw new Error('invalid_readings');
    const trend=typeof item.Trend==='string'&&/^[A-Za-z]{1,24}$/.test(item.Trend)?item.Trend:'None';
    rows.set(stamp,{recorded_at:new Date(stamp).toISOString(),value_mg_dl:item.Value,trend});
  }
  return [...rows.values()].sort((a,b)=>a.recorded_at.localeCompare(b.recorded_at));
}
async function handler(req){
  if(req.headers.has('origin'))return response(403,{message:'Server-only endpoint.'});
  if(req.method!=='POST')return response(405,{message:'Use POST.'});
  const expected=Deno.env.get('DEXCOM_SYNC_TOKEN')||'';
  const supplied=req.headers.get('x-orbit-sync-token')||'';
  if(!/^[0-9a-f]{64}$/.test(expected))return response(503,{message:'Scheduler token is not configured.'});
  if(!/^[0-9a-f]{64}$/.test(supplied))return response(401,{message:'Scheduler authentication required.'});
  const digest=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
  const [actualHash,expectedHash]=await Promise.all([digest(supplied),digest(expected)]);
  let difference=0;for(let i=0;i<expectedHash.length;i++)difference|=actualHash[i]^expectedHash[i];
  if(difference!==0)return response(401,{message:'Scheduler authentication failed.'});
  const owner=Deno.env.get('DEXCOM_OWNER_USER_ID');
  if(!uuid(owner))return response(503,{message:'Set DEXCOM_OWNER_USER_ID to your Supabase login user ID first.'});
  const username=Deno.env.get('DEXCOM_SHARE_USERNAME'),password=Deno.env.get('DEXCOM_SHARE_PASSWORD'),region=Deno.env.get('DEXCOM_SHARE_REGION');
  const bases={us:'https://share2.dexcom.com/',ous:'https://shareous1.dexcom.com/',jp:'https://share.dexcom.jp/'};
  let service;
  try{service=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');}catch{}
  if(!username||!password||!bases[region]||!service)return response(503,{message:'Dexcom or server secrets are incomplete. Region must be us, ous or jp.'});
  const db=async(path,method='GET',data=null)=>{
    const result=await fetch(PROJECT+'/rest/v1/'+path,{method,headers:{apikey:service,...(service.startsWith('eyJ')?{Authorization:'Bearer '+service}:{}),'Content-Type':'application/json',...(!path.startsWith('rpc/')&&method==='POST'?{Prefer:'resolution=merge-duplicates,return=minimal'}:{})},...(data!==null?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(10000)});
    if(!result.ok)throw new Error('storage_error');const text=await result.text();return text?JSON.parse(text):null;
  };
  let claimed=false;
  try{
    claimed=await db('rpc/orbit_claim_glucose_sync','POST',{owner_id:owner});
    if(!claimed)return response(429,{message:'Sync already running or requested recently. Wait one minute.'});
    const bytes=new TextEncoder().encode(JSON.stringify([username,password,region]));
    const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
    const saved=await db('orbit_share_session?user_id=eq.'+owner+'&select=session_id,credential_fingerprint');
    let session=saved?.[0]?.credential_fingerprint===fingerprint?saved[0].session_id:null;
    const share=async(endpoint,body=null,params='')=>{
      const result=await fetch(bases[region]+'ShareWebServices/Services/'+endpoint+params,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
      let data;try{data=await result.json();}catch{throw new Error('share_unavailable');}
      if(!result.ok||data?.Code){
        if(/Session/.test(data?.Code||''))throw new Error('session_expired');
        if(/Account|Password|Authenticate/.test(data?.Code||''))throw new Error('share_auth_failed');
        throw new Error('share_unavailable');
      }return data;
    };
    const login=async()=>{
      const applicationId=region==='jp'?'d8665ade-9673-4e27-9ff6-92db4ce13d13':'d89443d2-327c-4a6f-89e5-496bbb0317db';
      const account=await share('General/AuthenticatePublisherAccount',{accountName:username,password,applicationId});
      if(!uuid(account))throw new Error('share_auth_failed');
      const next=await share('General/LoginPublisherAccountById',{accountId:account,password,applicationId});
      if(!uuid(next))throw new Error('share_auth_failed');
      await db('orbit_share_session','POST',{user_id:owner,session_id:next,credential_fingerprint:fingerprint,updated_at:new Date().toISOString()});return next;
    };
    const read=()=>share('Publisher/ReadPublisherLatestGlucoseValues',null,'?sessionId='+encodeURIComponent(session)+'&minutes=1440&maxCount=288');
    if(!uuid(session))session=await login();
    let readings;
    try{readings=await read();}catch(error){if(error.message!=='session_expired')throw error;session=await login();readings=await read();}
    const rows=normalize(readings);
    if(!rows.length)throw new Error('no_readings');
    const stored=await db('rpc/orbit_store_glucose','POST',{owner_id:owner,readings:rows});
    const latest=rows[rows.length-1].recorded_at;
    return response(200,{ok:true,received:rows.length,reconciled:stored,latest_at:latest,stale:Date.now()-Date.parse(latest)>15*60000,
      message:'Recent readings stored by the scheduled collector.'});
  }catch(error){
    const allowed=['share_auth_failed','share_unavailable','invalid_readings','no_readings','session_expired','storage_error'];
    const code=allowed.includes(error.message)?error.message:'connection_failed';
    if(claimed)try{await db('orbit_glucose_sync?user_id=eq.'+owner,'PATCH',{locked_until:new Date().toISOString(),error_code:code});}catch{}
    const messages={share_auth_failed:'Dexcom authentication failed. Check your own login, Share setup and region.',no_readings:'Share returned no recent readings. Check G7 Share and follower setup.',invalid_readings:'Unexpected glucose values or timestamps; batch was not stored.',storage_error:'Database setup or permissions need checking.'};
    return response(502,{error:code,message:messages[code]||'Dexcom could not sync. No raw provider error was exposed; try again later.'});
  }
}
Deno.serve(handler);
