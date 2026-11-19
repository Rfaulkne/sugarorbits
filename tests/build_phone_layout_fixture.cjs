// Generates a temporary synthetic browser QA page, never part of deployment.
const fs=require('node:fs'),path=require('node:path');
const target=process.argv[2];if(!target||!target.endsWith('/dist/__qa/rhythm.html'))throw new Error('Use the temporary dist/__qa/rhythm.html path.');
let html=fs.readFileSync('cloud-phone/index.html','utf8').replace(/(href|src)="(style\.css|rhythm\.js|orbit-draw\.js|app\.js)/g,'$1="/moments/$2');
const mock=`<script>
// SYNTHETIC LAYOUT FIXTURE. Never calls a real API.
const fixtureRows=[];for(let i=0;i<14*288;i++){const t=Date.now()-i*300000;const h=new Date(t).getUTCHours();fixtureRows.push({recorded_at:new Date(t).toISOString(),value_mg_dl:Math.round(125+55*Math.sin(h/24*Math.PI*2)+14*Math.sin(i/14))});}fixtureRows.sort((a,b)=>a.recorded_at.localeCompare(b.recorded_at));
window.fetch=async(url,opt={})=>{let result=[];if(url.includes('grant_type=password'))result={access_token:'synthetic-only',expires_at:Date.now()/1000+3600,user:{id:'synthetic-layout-only'}};else if(url.includes('order=recorded_at.asc')){const cursor=new URL(url).searchParams.get('recorded_at');const filters=[...new URL(url).searchParams.getAll('recorded_at')];const gt=filters.find(s=>s.startsWith('gt.'))?.slice(3);result=fixtureRows.filter(r=>!gt||r.recorded_at>gt).slice(0,1000);}else if(url.includes('orbit_glucose?'))result=[fixtureRows[fixtureRows.length-1]];else if(url.includes('orbit_glucose_sync?'))result=[{succeeded_at:new Date().toISOString(),error_code:null}];else if(url.includes('orbit_events?'))result=[];else if(url.includes('/functions/'))return new Response(JSON.stringify({message:'Synthetic layout fixture: live functions are disabled.'}),{status:503});return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});};
</script>`;
html=html.replace('<script src="/moments/rhythm.js"',mock+'<script src="/moments/rhythm.js"').replace('<main>','<main><p style="color:#f3894b">SYNTHETIC LAYOUT FIXTURE — NOT YOUR DATA</p>');
fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,html);console.log(target);
