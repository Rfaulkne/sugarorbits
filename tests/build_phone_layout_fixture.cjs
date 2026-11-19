// Generates a temporary synthetic browser QA page, never part of deployment.
const fs=require('node:fs'),path=require('node:path');
const target=process.argv[2];if(!target||!target.endsWith('/dist/__qa/rhythm.html'))throw new Error('Use the temporary dist/__qa/rhythm.html path.');
let html=fs.readFileSync('cloud-phone/index.html','utf8').replace(/(href|src)="(style\.css|rhythm\.js|rhythm-lenses\.js|rhythm-calm\.js|orbit-draw\.js|after-moment\.js|focus-core\.js|pwa\.js|app\.js|manifest\.webmanifest|app-icon-180\.png)/g,'$1="/moments/$2').replace(/<script src="\/moments\/pwa\.js[^>]*><\/script>/,'');
const mock=`<script>
// SYNTHETIC LAYOUT FIXTURE. Never calls a real API.
const fixtureRows=[];for(let i=0;i<14*288;i++){const t=Date.now()-i*300000;const h=new Date(t).getUTCHours();fixtureRows.push({recorded_at:new Date(t).toISOString(),value_mg_dl:h>=11&&h<14?216:Math.round(125+40*Math.sin(h/24*Math.PI*2)+14*Math.sin(i/14))});}fixtureRows.sort((a,b)=>a.recorded_at.localeCompare(b.recorded_at));
window.OrbitPWA={enable:async()=> 'Synthetic fixture: no real notification permission was requested.',disable:async()=>{}};
let fixturePlans=[];
const fixtureFacts={before:{eligible:7,high:.3,low:.01,range:.69},after:{eligible:7,high:.1,low:.01,range:.89},outcome:{code:'improved',label:'A clearer improvement in the recorded window'},tags:{activity:2,stress:1,other:0}};
function fixtureFocus(input){
 if(input.action==='start')fixturePlans=[{id:'fixture-focus',revision:1,expires_at:new Date(Date.now()+28*864e5).toISOString(),plan:{started:Date.now(),kind:input.kind,start:input.start,habit:input.habit,status:'active',checkins:{},baseline:{eligible:7,high:.3,low:.01,range:.69},reminder:{enabled:false,lead:15,minute:1080,quiet_start:1320,quiet_end:480,frequency:7}}}];
 if(input.action==='checkin')fixturePlans[0].plan.checkins[window.OrbitRhythm.local(Date.now()).date]={status:input.status,note:input.note};
 if(input.action==='reminder')fixturePlans[0].plan.reminder=input.reminder;
 if(input.action==='reflect'){fixturePlans[0].plan.status='maintaining';fixturePlans[0].plan.reflection={worked:input.worked};}
 if(input.action==='finish')fixturePlans[0].plan.status='completed';
 if(input.action==='delete')fixturePlans=[];
 return input.action==='review'?{facts:fixtureFacts}:input.action==='coach'?{facts:fixtureFacts,question:'What felt useful, and what would you like to keep?',ideas:['Tag the context when this window comes around.']}:{plans:fixturePlans,reminders_configured:false};
}
window.fetch=async(url,opt={})=>{let result=[];if(url.includes('grant_type=password'))result={access_token:'synthetic-only',expires_at:Date.now()/1000+3600,user:{id:'synthetic-layout-only'}};else if(url.includes('order=recorded_at.asc')){const cursor=new URL(url).searchParams.get('recorded_at');const filters=[...new URL(url).searchParams.getAll('recorded_at')];const gt=filters.find(s=>s.startsWith('gt.'))?.slice(3);result=fixtureRows.filter(r=>!gt||r.recorded_at>gt).slice(0,1000);}else if(url.includes('orbit_glucose?'))result=[fixtureRows[fixtureRows.length-1]];else if(url.includes('orbit_glucose_sync?'))result=[{succeeded_at:new Date().toISOString(),error_code:null}];else if(url.includes('orbit_events?'))result=[];else if(url.includes('/functions/'))return new Response(JSON.stringify({message:'Synthetic layout fixture: live functions are disabled.'}),{status:503});return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});};
</script>`;
const enhanced=mock.replace("else if(url.includes('/functions/'))", "else if(url.includes('/functions/v1/orbit-focus'))result=fixtureFocus(JSON.parse(opt.body));else if(url.includes('/functions/'))").replace("else if(url.includes('orbit_events?'))result=[]", "else if(url.includes('orbit_events?'))result=['activity','stress','other'].map((kind,i)=>({id:'fixture-'+i,kind,occurred_at:new Date(Date.now()-(8+i*4)*3600000).toISOString()}))").replace("result=fixtureRows.filter(r=>!gt||r.recorded_at>gt).slice(0,1000)","result=fixtureRows.filter(r=>(!gt||r.recorded_at>gt)&&filters.every(f=>f.startsWith('gte.')?r.recorded_at>=f.slice(4):f.startsWith('lte.')?r.recorded_at<=f.slice(4):true)).slice(0,1000)");
html=html.replace('<script src="/moments/rhythm.js"',enhanced+'<script src="/moments/rhythm.js"').replace('<main>','<main><p style="color:#f3894b">SYNTHETIC LAYOUT FIXTURE — NOT YOUR DATA</p>');
fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,html);console.log(target);
