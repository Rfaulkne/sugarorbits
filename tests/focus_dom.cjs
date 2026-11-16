// DOM integration fallback when a browser cannot launch. Not a Safari/layout test.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM,VirtualConsole}=require(process.env.ORBIT_JSDOM||'jsdom');
const {createCanvas,GlobalFonts}=require('@napi-rs/canvas');
const fontPath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
if(fs.existsSync(fontPath))GlobalFonts.registerFromPath(fontPath,'sans-serif');
const base='http://127.0.0.1:8879';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let n=0;n<80;n++){if(fn())return;await wait(100);}throw new Error('Timed out: '+fn.toString());}
async function open(url){
  const errors=[],backings=new WeakMap();
  const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>errors.push(e.message));
  const dom=await JSDOM.fromURL(base+url,{resources:'usable',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole,
    beforeParse(w){
      w.fetch=(url,opts)=>fetch(new URL(url,base),opts);w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;
      w.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({width:800,height:800,left:0,top:0,right:800,bottom:800});
      w.HTMLCanvasElement.prototype.getContext=function(){if(!backings.has(this))backings.set(this,createCanvas(this.width,this.height));return backings.get(this).getContext('2d');};
      w.HTMLCanvasElement.prototype.setPointerCapture=()=>{};
    }});
  await until(()=>dom.window.OrbitClient?.state);
  return {dom,w:dom.window,$:s=>dom.window.document.querySelector(s),errors,backings};
}
(async()=>{
  const phone=await open('/phone');const {w,$}=phone;
  const click=s=>$(s).click();
  click('[data-quick=activity]');await until(()=>w.OrbitClient.state.events.some(e=>e.kind==='activity'));
  const eventId=w.OrbitClient.state.events.find(e=>e.kind==='activity').id;
  assert.equal(w.OrbitClient.pending().length,0);
  click('[data-tab=focus]');click('.candidate');$('#habit').value='Notice lunch';
  $('#focus-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  try{await until(()=>!!w.OrbitClient.state.focus);}catch(e){console.error('Focus diagnostic', $('#focus-start').value,$('#focus-end').value,$('#toast-text').textContent,phone.errors);console.error((await (await fetch(base+'/api/v2/state')).json()).focus);throw e;}
  click('#active-focus .checkin-buttons button');await until(()=>w.OrbitClient.state.focus.doneDays===1);
  click('[data-tab=food]');$('#portion-weight').value='150';$('#carbs-density').value='28';$('#carbs-density').dispatchEvent(new w.Event('input'));
  assert.equal($('#label-result').textContent,'42.0 g carbohydrate');click('#use-label');assert.equal($('#confirmed-carbs').value,'42.0');assert.equal($('#carbs-checked').checked,false);
  $('#carbs-checked').checked=true;$('#food-note').value='checked label';$('#food-save').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>w.OrbitClient.state.events.some(e=>e.kind==='food'&&e.carbs===42));
  const onlineFetch=w.fetch;w.fetch=()=>Promise.reject(new TypeError('offline'));
  click('[data-quick=stress]');await until(()=>w.OrbitClient.pending().length===1);const pending=w.OrbitClient.pending()[0];
  const removal=await w.OrbitClient.remove(pending.id);assert.equal(removal.queued,true);assert.equal(w.OrbitClient.pending().length,0);
  w.fetch=onlineFetch;await w.OrbitClient.flush();await w.OrbitClient.refresh();assert(!w.OrbitClient.state.events.some(e=>e.id===pending.id));
  const round=await open('/rhythm');assert(round.w.OrbitClient.state.events.some(e=>e.id===eventId));
  round.$('[data-mode=days]').click();round.$('#orbit').onpointermove({pointerType:'mouse',clientX:675,clientY:400});assert(round.$('#centre-title').textContent.includes('in range'));
  round.$('#orbit').onpointerleave();assert(round.$('#centre-title').textContent.includes('mmol/L'));
  // Use the real canvas renderer to produce a synthetic chart preview (not a browser screenshot).
  const demo=await open('/rhythm?demo=1');
  const canvas=demo.backings.get(demo.$('#orbit')),ctx=canvas.getContext('2d');
  ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#0c100f';ctx.fillRect(0,0,800,800);ctx.globalCompositeOperation='source-over';
  ctx.textAlign='center';ctx.fillStyle='#99a594';ctx.font='12px sans-serif';ctx.fillText('SUGAR ORBITS · SYNTHETIC PREVIEW',400,106);
  ctx.font='11px sans-serif';ctx.fillText('YOUR WEEKLY RHYTHM',400,355);
  ctx.fillStyle='#edf0e5';ctx.font='34px sans-serif';ctx.fillText(demo.$('#centre-title').textContent,400,405);
  ctx.fillStyle='#99a594';ctx.font='13px sans-serif';ctx.fillText('grey · this week     purple · previous week',400,440);
  ctx.font='11px sans-serif';ctx.fillText('Chart render only · physical screen QA pending',400,706);
  const output=path.join(__dirname,'..','docs','previews');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'rhythm-v2-chart.png'),canvas.toBuffer('image/png'));
  assert.deepEqual([...phone.errors,...round.errors,...demo.errors],[]);
  for(const d of [phone,round,demo])d.dom.window.close();
  console.log('PASS DOM/HTTP: quick tag, focus, check-in, food label arithmetic, confirmed meal log, offline queue and removal, shared display state, nearest-ring hover.');
})().catch(e=>{console.error(e);process.exit(1);});
