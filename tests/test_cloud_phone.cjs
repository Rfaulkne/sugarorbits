const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map(),calls=[],timers=[],storage=new Map();
let glucoseRows=[],syncRows=[],historyRows=[];
function el(){return {hidden:false,value:'',checked:false,textContent:'',disabled:false,dataset:{},children:[],open:false,videoWidth:640,videoHeight:480,showModal(){this.open=true},close(){this.open=false},play:async()=>{},getContext(){return {drawImage(){},fillRect(){}}},toDataURL(){return 'data:image/jpeg;base64,/9j/AA=='},classList:{add(){},remove(){}},append(...x){this.children.push(...x)},replaceChildren(){this.children=[]},setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]}}}
const get=id=>{if(!elements.has(id))elements.set(id,el());return elements.get(id)};
const tags=['activity','stress','other'].map(kind=>Object.assign(el(),{dataset:{kind}}));
const tabs=['rhythm','focus','food'].map(tab=>Object.assign(el(),{dataset:{tab}}));
const checks=['tried','not-today','skip'].map(checkin=>Object.assign(el(),{dataset:{checkin}}));
const context={document:{getElementById:get,querySelectorAll:s=>s==='[data-kind]'?tags:s==='[data-tab]'?tabs:s==='[data-checkin]'?checks:[...elements.values(),...tags,...tabs,...checks],createElement:el,addEventListener(){}},window:{URL,OrbitRhythm:require('../cloud-phone/rhythm.js'),addEventListener(){}},navigator:{},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:require('node:crypto').webcrypto,AbortSignal,Date,Error,JSON,Math,encodeURIComponent,
 setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},
 fetch:async(url,opt)=>{calls.push({url,opt});let data=null;
 if(url.includes('grant_type=password'))data={access_token:'test-token',expires_at:Date.now()/1000+3600,user:{id:'test-owner'}};
 else {assert.equal(opt.headers.Authorization,'Bearer test-token');
 if(url.includes('order=recorded_at.asc'))data=url.includes('recorded_at=gt.')?[]:historyRows;
 else if(url.includes('/rest/v1/orbit_events?select='))data=[];
 else if(url.includes('/rest/v1/orbit_glucose?'))data=glucoseRows;
 else if(url.includes('/rest/v1/orbit_glucose_sync?'))data=syncRows;
 else if(url.includes('/functions/v1/dexcom-sync')){glucoseRows=[{recorded_at:new Date().toISOString(),value_mg_dl:126}];syncRows=[{succeeded_at:new Date().toISOString(),error_code:null}];data={ok:true,received:1};}
 else if(url.includes('/functions/'))data={foods:['rice'],carbs_low_g:30,carbs_high_g:50,question:'',assumptions:['Portion supplied.']};}
 return {ok:true,text:async()=>data?JSON.stringify(data):''};}};
vm.runInNewContext(fs.readFileSync('cloud-phone/app.js','utf8'),context);
const settle=()=>new Promise(r=>setImmediate(r));
(async()=>{
 get('email').value='test@example.invalid';get('password').value='mock-password';get('login-form').onsubmit({preventDefault(){}});await settle();
 assert.equal(get('password').value,'');assert.equal(get('moments').hidden,false);
 assert.equal(get('panel-rhythm').hidden,false);assert.equal(get('quick-log').hidden,false);
 tags[0].onclick();await settle();assert.equal(get('toast-label').textContent,'Logged ✓');assert.equal(get('toast').hidden,false);
 assert.equal(calls.filter(x=>x.opt.method==='POST'&&x.url.includes('/orbit_events')).length,1);
 assert.equal(get('quick-log').hidden,true);get('quick-log-toggle').onclick();assert.equal(get('quick-log').hidden,false);
 get('undo').onclick();await settle();assert.ok(calls.some(x=>x.opt.method==='DELETE'));assert.equal(get('toast-label').textContent,'Removed ✓');
 tabs[2].onclick();assert.equal(get('panel-food').hidden,false);assert.equal(get('panel-rhythm').hidden,true);
 get('home-focus').onclick();assert.equal(get('panel-focus').hidden,false);get('focus-kind').value='high';get('focus-window').value='720';get('focus-habit').value='Notice afternoons';get('focus-plan').onsubmit({preventDefault(){}});await settle();assert.equal(get('focus-thread').hidden,false);assert.ok(storage.has('orbit-focus-phone-v1:test-owner'));checks[0].onclick();await settle();assert.ok(get('focus-checkin-status').textContent.includes('Tried it'));get('focus-note').value='A busy day';get('save-focus-note').onclick();await settle();assert.equal(JSON.parse(storage.get('orbit-focus-phone-v1:test-owner')).habit,'Notice afternoons');get('finish-focus').onclick();await settle();assert.equal(get('focus-thread').hidden,true);tabs[2].onclick();
 assert.equal(get('staples').children.length,2);get('staples').children[0].children[0].onclick();assert.equal(get('foods').value,'Rice (cooked)');assert.equal(get('portion').value,'100 g cooked');assert.equal(get('food-confirm').hidden,false);
 get('text-food').onclick();assert.equal(get('foods').value,'');assert.equal(get('food-confirm').hidden,false);
 get('foods').value='My bread';get('portion').value='2 slices';get('save-staple').onclick();assert.ok(storage.has('orbit-staples-v1:test-owner'));assert.equal(get('staples').children.length,3);
 get('manage-staples').onclick();get('staples').children[2].children[1].onclick();assert.equal(get('staples').children.length,2);
 await get('scan-now').onclick();assert.ok(get('status').textContent.includes('camera is unavailable'));
 let stopped=0;context.navigator.mediaDevices={getUserMedia:async()=>({getTracks:()=>[{stop(){stopped++}}]})};
 const beforeCameraCalls=calls.length;await get('scan-now').onclick();assert.equal(get('camera-dialog').open,true);get('shutter').onclick();assert.equal(get('camera-dialog').open,false);assert.equal(stopped,1);assert.equal(get('photo-preview').hidden,false);assert.equal(get('identify').hidden,false);assert.equal(calls.length,beforeCameraCalls);
 let release;context.navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{release=resolve});const opening=get('scan-now').onclick();get('camera-cancel').onclick();release({getTracks:()=>[{stop(){stopped++}}]});await opening;assert.equal(stopped,2);assert.equal(get('camera-dialog').open,false);
 get('foods').value='rice';get('portion').value='150g cooked';get('estimate').onclick();await settle();assert.equal(calls.filter(x=>x.url.includes('/functions/')).length,0);
 get('food-consent').checked=true;get('estimate').onclick();await settle();assert.equal(get('carbs').textContent,'30–50 g');assert.equal(get('food-result').hidden,false);
 const call=calls.find(x=>x.url.includes('/functions/'));assert.equal(JSON.parse(call.opt.body).mode,'estimate');assert.equal(JSON.parse(call.opt.body).consent,true);
 get('portion').oninput();assert.equal(get('food-result').hidden,true);
 const yesterday=Date.now()-864e5;historyRows=[126,126,216,126,54].map((value_mg_dl,i)=>({recorded_at:new Date(yesterday+i*300000).toISOString(),value_mg_dl}));
 get('dexcom-sync').onclick();await settle();assert.equal(get('dexcom-value').textContent,'7.0');assert.equal(get('dexcom-unit').hidden,false);assert.ok(get('dexcom-status').textContent.includes('Recent stored'));
 assert.equal(get('rhythm-range').textContent,'60%');assert.ok(calls.some(x=>x.url.includes('recorded_at=gt.')));
 const syncCall=calls.find(x=>x.url.includes('/functions/v1/dexcom-sync'));assert.equal(syncCall.opt.headers.Authorization,'Bearer test-token');assert.equal(syncCall.opt.body,'{}');
 glucoseRows=[{recorded_at:new Date(Date.now()-3600000).toISOString(),value_mg_dl:90}];syncRows=[{error_code:'share_unavailable'}];get('dexcom-refresh').onclick();await settle();assert.equal(get('dexcom-value').textContent,'5.0');assert.ok(get('dexcom-status').textContent.includes('Older reading'));assert.ok(get('dexcom-status').textContent.includes('previously saved'));
 glucoseRows=[{recorded_at:'invalid',value_mg_dl:90}];get('dexcom-refresh').onclick();await settle();assert.equal(get('dexcom-value').textContent,'—');assert.equal(get('dexcom-unit').hidden,true);
 get('logout').onclick();await settle();assert.equal(get('moments').hidden,true);assert.equal(get('foods').value,'');assert.equal(get('carbs').textContent,'');
 assert.equal(get('dexcom-value').textContent,'—');assert.equal(get('dexcom-time').textContent,'');
 assert.equal(get('staples').children.length,0);
 console.log('PASS: mocked login, tag/Undo, tabs, direct entry, default/save/remove account-scoped favourites, camera fallback, consent, estimates and logout cleanup. No live requests.');
})().catch(e=>{console.error(e);process.exitCode=1});
