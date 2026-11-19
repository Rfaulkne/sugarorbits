/* Public project configuration. Never put secret/service-role keys here. */
(() => {
  'use strict';
  const URL = 'https://hinknpgmmhkqphsgvuek.supabase.co';
  const KEY = 'sb_publishable_M-0fIrNtiOrSOoDfpjh2TA_dUvGCRx_';
  const $ = id => document.getElementById(id);
  // In-memory session only for this initial test; reload requires signing in.
  // No password, token, photos or event queue is persisted on this device.
  // Only account-scoped food-name/portion favourites are stored locally.
  let session = null, refreshing = null, busy = false, generation = 0;
  let image = null, photoGeneration = 0, undoId = null, toastTimer, fadeTimer;
  let cameraStream=null,cameraGeneration=0,editingStaples=false;
  let rhythmRows=[],rhythmEvents=[],rhythmState=null,orbit=null;
  const R=window.OrbitRhythm;
  const say = text => { $('status').textContent = text; };
  async function request(path, options = {}, token) {
    const response = await fetch(URL + path, {...options, cache:'no-store',
      headers:{apikey:KEY, ...(token ? {Authorization:'Bearer ' + token} : {}),
        'Content-Type':'application/json', ...options.headers}, signal:AbortSignal.timeout(path.startsWith('/functions/') ? 50000 : 15000)});
    const body = await response.text();
    const data = body ? JSON.parse(body) : null;
    if (!response.ok) throw new Error(data?.msg || data?.error_description || data?.message || 'Request failed. Try again.');
    return data;
  }
  async function access() {
    if (!session) throw new Error('Please sign in.');
    if (session.expires_at * 1000 < Date.now() + 60000) {
      if (!refreshing) {
        const current = generation;
        refreshing = request('/auth/v1/token?grant_type=refresh_token', {
          method:'POST', body:JSON.stringify({refresh_token:session.refresh_token})
        }).then(data => {
          if (current !== generation) throw new Error('Session changed. Please sign in again.');
          session = data; return data;
        }).finally(() => {refreshing = null;});
      }
      await refreshing;
    }
    return session.access_token;
  }
  function showSession() {
    $('login').hidden = !!session; $('moments').hidden = !session;
    $('toast').hidden=true;undoId=null;clearPhoto();
    editingStaples=false;renderStaples();
    rhythmRows=[];rhythmEvents=[];rhythmState=null;setTab('rhythm');setQuickLog(true);
    for(const id of ['focus-habit','focus-note'])$(id).value='';
    for(const id of ['focus-title','focus-habit-copy','focus-progress','focus-comparison','focus-review-date','focus-checkin-status'])$(id).textContent='';
    $('rhythm-range').textContent='—';$('rhythm-coverage').textContent='Loading your recorded rhythm…';
    if(orbit)orbit.draw(null);renderFocus();
    $('dexcom-value').textContent='—';$('dexcom-unit').hidden=true;$('dexcom-time').textContent='';$('dexcom-sync-time').textContent='';$('dexcom-status').textContent='No readings checked yet.';
  }
  function toast(text,id=null) {
    clearTimeout(toastTimer);clearTimeout(fadeTimer);undoId=id;
    $('toast-label').textContent=text;$('undo').hidden=!id;$('toast').hidden=false;$('toast').classList.remove('fading');
    toastTimer=setTimeout(()=>{$('toast').classList.add('fading');fadeTimer=setTimeout(()=>{$('toast').hidden=true;undoId=null;},450);},id?8000:3000);
  }
  function clearPhoto() {
    stopCamera();
    photoGeneration++;image=null;$('photo').value='';$('photo-preview').hidden=true;$('photo-preview').removeAttribute('src');
    $('food-confirm').hidden=true;$('food-result').hidden=true;$('foods').value='';$('portion').value='';$('food-consent').checked=false;$('identify').disabled=true;
    $('carbs').textContent='';$('food-question').textContent='';$('assumptions').replaceChildren();
    $('identify').hidden=true;
  }
  const defaults=[{foods:'Rice (cooked)',portion:'100 g cooked'},{foods:'Bread',portion:''}];
  function staplesKey(){return session?.user?.id?'orbit-staples-v1:'+session.user.id:null;}
  function readStaples(){
    try{const raw=localStorage.getItem(staplesKey());if(raw===null)return defaults.map(x=>({...x}));
      const list=JSON.parse(raw);return Array.isArray(list)?list.filter(x=>typeof x.foods==='string'&&x.foods.length<=500&&typeof x.portion==='string'&&x.portion.length<=300).slice(0,8):[];
    }catch{return defaults.map(x=>({...x}));}
  }
  function writeStaples(list){const key=staplesKey();if(!key)throw new Error('Sign in again before saving a favourite.');localStorage.setItem(key,JSON.stringify(list));}
  function openText(foods='',portion=''){
    clearPhoto();$('food-confirm').hidden=false;$('foods').value=foods;$('portion').value=portion;
    say('Describe the food and amount. No photo needed.');
  }
  function renderStaples(){
    $('staples').replaceChildren();$('manage-staples').textContent=editingStaples?'Done':'Edit';if(!session)return;
    readStaples().forEach((item,index)=>{const wrap=document.createElement('div');wrap.className='staple';const button=document.createElement('button');button.textContent=item.foods;button.onclick=()=>{if(!busy)openText(item.foods,item.portion);};wrap.append(button);
      if(editingStaples){const remove=document.createElement('button');remove.className='remove-staple';remove.textContent='×';remove.setAttribute('aria-label','Remove '+item.foods);remove.onclick=()=>{if(busy)return;try{writeStaples(readStaples().filter((_,i)=>i!==index));renderStaples();}catch(error){say('Could not save favourites on this device.');}};wrap.append(remove);}
      $('staples').append(wrap);});
  }
  $('manage-staples').onclick=()=>{if(!busy){editingStaples=!editingStaples;renderStaples();}};
  $('text-food').onclick=()=>{if(!busy)openText();};
  $('save-staple').onclick=()=>{
    if(busy)return;const foods=$('foods').value.trim(),portion=$('portion').value.trim();if(!foods){say('Add a food name first.');return;}
    try{const list=readStaples().filter(x=>x.foods.toLowerCase()!==foods.toLowerCase());if(list.length>=8){say('Eight staples saved. Tap Edit to remove one first.');return;}writeStaples([...list,{foods,portion}]);renderStaples();toast('Staple saved ✓');}catch{say('This browser could not save favourites. You can still estimate without saving.');}
  };
  function stopCamera(){
    cameraGeneration++;cameraStream?.getTracks().forEach(track=>track.stop());cameraStream=null;$('camera').srcObject=null;
    if($('camera-dialog').open)$('camera-dialog').close();
  }
  function acceptPicture(picture,width,height){
    if(!width||!height)throw new Error('The camera is not ready. Try again.');
    const scale=Math.min(1,1024/Math.max(width,height)),canvas=document.createElement('canvas');
    canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(picture,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/jpeg',.75);if(data.length>1400000)throw new Error('Please choose a smaller photo.');
    image=data;$('photo-preview').src=image;$('photo-preview').hidden=false;$('identify').hidden=false;$('identify').disabled=false;say('Photo ready. Nothing has been sent yet.');
  }
  $('scan-now').onclick=async()=>{
    if(busy)return;stopCamera();const current=cameraGeneration;
    if(!navigator.mediaDevices?.getUserMedia){say('In-app camera is unavailable here. Use “choose an existing photo” to take or select one.');return;}
    $('camera-dialog').showModal();$('camera-status').textContent='Opening camera…';$('shutter').disabled=true;
    try{const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});
      if(current!==cameraGeneration){stream.getTracks().forEach(track=>track.stop());return;}
      cameraStream=stream;$('camera').srcObject=stream;await $('camera').play();
      if(current!==cameraGeneration)return;$('shutter').disabled=false;$('camera-status').textContent='Ready. Capture when the plate is in view.';
    }catch{if(current===cameraGeneration){stopCamera();say('Camera could not open. Check camera permission, or use “choose an existing photo”.');}}
  };
  $('shutter').onclick=()=>{try{const video=$('camera');const width=video.videoWidth,height=video.videoHeight;
    // Draw before stopping the stream, then clear any earlier food draft.
    const snapshot=document.createElement('canvas');snapshot.width=width;snapshot.height=height;snapshot.getContext('2d').drawImage(video,0,0);
    clearPhoto();acceptPicture(snapshot,width,height);
  }catch(error){say(error.message);stopCamera();}};
  $('camera-cancel').onclick=stopCamera;$('camera-dialog').oncancel=stopCamera;
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();});window.addEventListener('pagehide',stopCamera);
  async function run(fn) {
    if (busy) return;busy=true;
    document.querySelectorAll('button, input, textarea').forEach(b=>b.disabled=true);
    try {await fn();} catch(error) {say(error.name==='TimeoutError' ? 'Connection timed out. Refresh before retrying; your moment may have saved.' : error.message);}
    finally {busy=false;document.querySelectorAll('button, input, textarea').forEach(b=>b.disabled=false);$('identify').disabled=!image;}
  }
  $('login-form').onsubmit=event=>{event.preventDefault();run(async()=>{
    say('Signing in…');
    const password=$('password').value;$('password').value='';
    session=await request('/auth/v1/token?grant_type=password', {method:'POST',body:JSON.stringify({email:$('email').value.trim(),password})});
    generation++;showSession();say('Connected.');
    try{await refreshDexcom();}catch{$('dexcom-status').textContent='Could not load glucose status. Open Coach and try Refresh status.';}
    try{await loadRhythm();}catch{$('rhythm-coverage').textContent='Could not load the complete rhythm window. Use Refresh status below to retry. No pattern conclusions are shown.';}
  });};
  document.querySelectorAll('[data-kind]').forEach(button=>button.onclick=()=>run(async()=>{
    const id=crypto.randomUUID();
    const event={id,kind:button.dataset.kind,occurred_at:new Date().toISOString()};
    await request('/rest/v1/orbit_events', {method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(event)}, await access());
    rhythmEvents.unshift(event);rhythmEvents=rhythmEvents.slice(0,20);paintRhythm();
    setQuickLog(false);say('');toast('Logged ✓',id);
  }));
  $('undo').onclick=()=>run(async()=>{const id=undoId;if(!id)return;await request('/rest/v1/orbit_events?id=eq.'+encodeURIComponent(id),{method:'DELETE'},await access());rhythmEvents=rhythmEvents.filter(e=>e.id!==id);paintRhythm();toast('Removed ✓');});
  function setQuickLog(show){$('quick-log').hidden=!show;$('quick-log-toggle').textContent=show?'Hide quick log':'Log moment';$('quick-log-toggle').setAttribute('aria-expanded',String(show));}
  $('quick-log-toggle').onclick=()=>{if(!busy)setQuickLog($('quick-log').hidden);};
  function setTab(tab){for(const name of ['rhythm','focus','food'])$('panel-'+name).hidden=name!==tab;document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));}
  document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{
    setTab(button.dataset.tab);say('');
  });
  $('home-focus').onclick=()=>{if(!busy){setTab('focus');renderFocus();}};
  const pct=n=>typeof n==='number'&&Number.isFinite(n)?Math.round(n*100)+'%':'—';
  const clock=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
  function focusKey(){return session?.user?.id?'orbit-focus-phone-v1:'+session.user.id:null;}
  function readFocus(){try{const f=JSON.parse(localStorage.getItem(focusKey())||'null');if(!f)return null;
    if(!['high','low','activity'].includes(f.kind)||!Number.isFinite(f.started)||f.started>Date.now()||Date.now()-f.started>28*864e5||typeof f.habit!=='string'||f.habit.length>160||!Number.isInteger(f.start)||f.start<0||f.start>1260){if(focusKey())localStorage.removeItem(focusKey());return null;}return f;
  }catch{return null;}}
  function saveFocus(f){const key=focusKey();if(!key)throw new Error('Sign in again before saving a focus.');localStorage.setItem(key,JSON.stringify(f));renderFocus();}
  function focusMetrics(f,baseline=false){if(!rhythmState||!R)return null;
    if(f.kind==='activity')return R.activityMetrics(rhythmState.all,rhythmEvents,baseline?f.started-7*864e5:f.started,baseline?f.started:Math.min(Date.now(),f.started+7*864e5));
    return R.metrics(baseline?rhythmState.current:rhythmState.all,f.start,f.start+180,baseline?-Infinity:f.started,baseline?f.started:Math.min(Date.now(),f.started+7*864e5));
  }
  function renderFocus(){
    const f=readFocus();$('focus-plan').hidden=!!f;$('focus-thread').hidden=!f;
    $('focus-window-label').hidden=$('focus-kind').value==='activity';
    if(!f){$('home-focus-title').textContent='What would you like to notice?';$('home-focus-description').textContent='Choose one period or explore tagged activity.';return;}
    const elapsed=Math.floor((Date.now()-f.started)/864e5),review=elapsed>=7;
    const title=f.kind==='activity'?'Around tagged activity':`${f.kind==='high'?'Above':'Below'} range · ${clock(f.start)}–${clock(f.start+180)}`;
    $('home-focus-title').textContent=title;$('home-focus-description').textContent=review?'Your seven-day reflection is ready to revisit.':`Day ${Math.min(7,elapsed+1)} of 7 · ${f.habit}`;
    $('focus-stage').textContent=review?'SEVEN-DAY REFLECTION':`DAY ${elapsed+1} OF 7`;$('focus-title').textContent=title;$('focus-habit-copy').textContent=f.habit;
    $('focus-review-date').textContent='Review from '+new Date(f.started+7*864e5).toLocaleDateString()+'. Plan and check-ins are saved on this phone only.';
    const today=R?R.local(Date.now()).date:new Date().toISOString().slice(0,10),entry=f.checkins?.[today];
    const names={tried:'Tried it','not-today':'Not today',skip:'Skipped',note:'Thought saved'};
    $('focus-checkin-status').textContent=entry?(names[entry.status]||'Checked in')+' today. You can change it.':'No check-in needed to keep exploring.';$('focus-note').value=typeof entry?.note==='string'?entry.note:'';
    $('focus-prompt').textContent=review?'What did you notice? Continue, adjust or finish—there is no automatic “resolved” verdict.':'How did your chosen experiment fit today?';
    const current=focusMetrics(f),base=f.baseline;
    const describe=m=>m&&m.eligible?`${m.eligible} covered ${f.kind==='activity'?'activity windows':'days'} · ${pct(m.range)} in range · ${pct(m.high)} above · ${pct(m.low)} below`:'Not enough covered windows to describe yet.';
    $('focus-progress').textContent='Recorded samples — Before: '+describe(base)+' During: '+describe(current);
    const enough=base?.eligible>=5&&current?.eligible>=5;
    $('focus-comparison').textContent=(enough?'Both periods have at least five covered windows. These are descriptive observations, not evidence that your experiment caused a change.':'Comparison is provisional: at least five covered windows in each period are needed before interpreting a change.')+(f.kind==='activity'?' Activity means the two hours after a tag; overlapping tags are combined. Untagged activity is unknown.':' Only complete three-hour windows with at least 70% sample coverage are counted.');
  }
  $('focus-kind').onchange=()=>{$('focus-window-label').hidden=$('focus-kind').value==='activity';};
  $('focus-plan').onsubmit=event=>{event.preventDefault();run(async()=>{
    if(readFocus())throw new Error('Finish the current focus before starting another.');
    const habit=$('focus-habit').value.trim();if(!habit)throw new Error('Describe one thing you will try or observe.');
    const f={started:Date.now(),kind:$('focus-kind').value,start:Number($('focus-window').value),habit,checkins:{}};
    f.baseline=focusMetrics(f,true);saveFocus(f);toast('Focus saved on this phone ✓');
  });};
  function checkIn(status){const f=readFocus();if(!f)return;const date=R?R.local(Date.now()).date:new Date().toISOString().slice(0,10);f.checkins=f.checkins||{};f.checkins[date]={status:status||f.checkins[date]?.status||'note',note:$('focus-note').value.slice(0,240)};saveFocus(f);toast('Check-in saved ✓');}
  document.querySelectorAll('[data-checkin]').forEach(b=>b.onclick=()=>run(async()=>checkIn(b.dataset.checkin)));
  $('save-focus-note').onclick=()=>run(async()=>checkIn(null));
  $('finish-focus').onclick=()=>run(async()=>{const key=focusKey();if(key)localStorage.removeItem(key);renderFocus();toast('Focus cleared from this phone');});
  function paintRhythm(){
    if(!R||!session)return;rhythmState=R.summarize(rhythmRows,rhythmEvents);
    $('rhythm-range').textContent=pct(rhythmState.rangeFraction);
    $('rhythm-period').textContent=R.shift(rhythmState.today,-7)+' to '+R.shift(rhythmState.today,-1)+' · Europe/Berlin';
    const bins=rhythmState.profile.filter(p=>p.mean!==null).length;
    $('rhythm-coverage').textContent=`${rhythmState.coveredDates} of 7 completed days have recorded samples; ${bins} of 48 clock sections can be drawn. `+(rhythmState.coveredDates<5?'Building a picture—do not interpret this as an established pattern.':'Averages describe available recordings; gaps and incomplete days can affect the shape.');
    if(window.OrbitCanvas){if(!orbit)orbit=new window.OrbitCanvas($('rhythm-canvas'),{mini:true});orbit.draw(rhythmState);}
    let observations=[];for(let start=0;start<1440;start+=180){const m=R.metrics(rhythmState.current,start,start+180);if(m.eligible>=3){for(const [key,name]of [['affectedHigh','above'],['affectedLow','below']])if(m[key]>=3)observations.push(`${clock(start)}–${clock(start+180)}: 3 consecutive five-minute samples ${name} range on ${m[key]} of ${m.eligible} covered days.`);}}
    $('focus-observation').textContent=observations.length?observations.slice(0,2).join(' ')+' Observations, not explanations.':'No recurring period meets the current minimum of three affected, adequately covered days. You can still choose something to observe.';
    renderFocus();
  }
  async function loadRhythm(){
    if(!R)return;const current=generation,token=await access(),focus=readFocus();
    const cutoff=new Date(Math.min(Date.now()-16*864e5,focus?.started||Date.now())).toISOString();let cursor=null,rows=[],complete=false;
    for(let page=0;page<20;page++){
      const result=await request('/rest/v1/orbit_glucose?select=recorded_at,value_mg_dl&order=recorded_at.asc&limit=1000&recorded_at=gte.'+encodeURIComponent(cutoff)+(cursor?'&recorded_at=gt.'+encodeURIComponent(cursor):''),{},token);
      if(!Array.isArray(result))throw new Error('Could not load rhythm history.');if(!result.length){complete=true;break;}
      const next=result[result.length-1].recorded_at;if(!Number.isFinite(Date.parse(next))||(cursor&&next<=cursor))throw new Error('History pagination did not advance.');rows.push(...result);cursor=next;
    }
    if(!complete)throw new Error('The full history window could not be loaded.');
    const events=await request('/rest/v1/orbit_events?select=id,kind,occurred_at&order=occurred_at.desc&limit=20',{},token);if(!Array.isArray(events))throw new Error('Could not load context tags.');
    if(current!==generation)return;rhythmRows=rows;rhythmEvents=events;paintRhythm();
  }
  window.addEventListener('resize',()=>{if(orbit&&rhythmState&&session)orbit.draw(rhythmState);});
  const friendlySyncErrors={share_auth_failed:'Dexcom login failed. Check your saved credentials, region and Share setup.',share_unavailable:'Dexcom Share was unavailable.',no_readings:'Share returned no recent readings.',invalid_readings:'An unexpected value or timestamp was rejected.',storage_error:'Cloud storage setup needs checking.',connection_failed:'The collector could not connect.',session_expired:'The Share session could not be renewed.'};
  async function refreshDexcom(){
    const current=generation,token=await access();
    const [rows,states]=await Promise.all([
      request('/rest/v1/orbit_glucose?select=recorded_at,value_mg_dl&order=recorded_at.desc&limit=1',{},token),
      request('/rest/v1/orbit_glucose_sync?select=succeeded_at,error_code&limit=1',{},token)
    ]);
    if(current!==generation)return;
    if(!Array.isArray(rows)||!Array.isArray(states))throw new Error('Unexpected glucose status response.');
    const row=rows[0],state=states[0];
    $('dexcom-value').textContent='—';$('dexcom-unit').hidden=true;$('dexcom-time').textContent='';
    const succeeded=Date.parse(state?.succeeded_at);
    $('dexcom-sync-time').textContent=Number.isFinite(succeeded)?'Last successful fetch: '+new Date(succeeded).toLocaleString():'';
    if(!row){$('dexcom-status').textContent=state?.error_code?(friendlySyncErrors[state.error_code]||'Last fetch failed. Try again later.'):'No cloud readings yet. Tap Fetch Dexcom data.';return;}
    const stamp=Date.parse(row.recorded_at),value=Number(row.value_mg_dl);
    if(!Number.isFinite(stamp)||!Number.isFinite(value)||value<20||value>600||stamp>Date.now()+5*60000){$('dexcom-status').textContent='Stored value or timestamp needs verification. No value displayed.';return;}
    const stale=Date.now()-stamp>15*60000;
    $('dexcom-value').textContent=(value/18).toFixed(1);$('dexcom-unit').hidden=false;
    $('dexcom-time').textContent='Reading time: '+new Date(stamp).toLocaleString();
    $('dexcom-status').textContent=(stale?'Older reading—more than 15 minutes old at this check.':'Recent stored reading at this check—compare its time with Dexcom.')+(state?.error_code?' Last fetch failed; this is previously saved data.':'');
  }
  $('dexcom-refresh').onclick=()=>run(async()=>{
    try{await refreshDexcom();await loadRhythm();say('Status and rhythm refreshed. No new Dexcom fetch was requested.');}catch(error){$('dexcom-status').textContent='Could not refresh the complete stored glucose view.';throw error;}
  });
  $('dexcom-sync').onclick=()=>run(async()=>{
    $('dexcom-status').textContent='Fetching recent readings from Dexcom Share…';say('');
    try{
      const result=await request('/functions/v1/dexcom-sync',{method:'POST',body:'{}'},await access());
      if(result.ok!==true)throw new Error('The collector did not confirm a successful fetch.');
      await refreshDexcom();await loadRhythm();say(`${result.received} recent readings reconciled. Repeated fetches do not add duplicates.`);
    }catch(error){$('dexcom-status').textContent='Fetch not confirmed: '+(error.name==='TimeoutError'?'The request timed out. Try Refresh status before fetching again.':error.message);throw error;}
  });
  $('photo').onchange=async()=>{
    if(busy)return;
    const file=$('photo').files[0];clearPhoto();if(!file)return;
    const current=photoGeneration;
    try{
      if(file.size>20*1024*1024)throw new Error('Please choose a photo smaller than 20 MB.');
      const objectUrl=URLglobal().createObjectURL(file),picture=new Image();
      try{await new Promise((resolve,reject)=>{picture.onload=resolve;picture.onerror=()=>reject(new Error('This photo could not be opened. Try a JPEG or a new camera photo.'));picture.src=objectUrl;});
        if(current!==photoGeneration)return;
        acceptPicture(picture,picture.naturalWidth,picture.naturalHeight);
      }finally{URLglobal().revokeObjectURL(objectUrl);}
    }catch(error){if(current===photoGeneration){clearPhoto();say(error.message);}}
  };
  // The project URL constant above intentionally differs from the browser URL API.
  function URLglobal(){return window.URL;}
  async function food(payload){
    if(!$('food-consent').checked)throw new Error('Please confirm sending this request to OpenAI.');
    return request('/functions/v1/food-genie',{method:'POST',body:JSON.stringify({...payload,consent:true})},await access());
  }
  $('identify').onclick=()=>run(async()=>{
    if(!image)throw new Error('Choose a photo first.');say('Looking at your photo…');
    const draft=await food({mode:'identify',image});$('foods').value=draft.foods.join(', ');$('food-confirm').hidden=false;$('food-result').hidden=true;
    say(draft.question||'Check the foods, then tell us how much you will eat.');
  });
  $('estimate').onclick=()=>run(async()=>{
    const foods=$('foods').value.trim(),portion=$('portion').value.trim();if(!foods||!portion)throw new Error('Confirm the foods and describe the amount first.');
    say('Estimating a rough range…');const draft=await food({mode:'estimate',foods,portion});
    $('carbs').textContent=draft.carbs_low_g===null?'More detail needed':`${Math.round(draft.carbs_low_g)}–${Math.round(draft.carbs_high_g)} g`;
    $('food-question').textContent=draft.question;$('assumptions').replaceChildren();for(const item of draft.assumptions){const li=document.createElement('li');li.textContent=item;$('assumptions').append(li);}
    $('food-result').hidden=false;say('');
  });
  for(const id of ['foods','portion'])$(id).oninput=()=>{$('food-result').hidden=true;};
  $('clear-photo').onclick=()=>{if(!busy){clearPhoto();say('Photo and draft cleared.');}};
  $('logout').onclick=()=>run(async()=>{
    const token=session?.access_token;session=null;generation++;showSession();say('Signed out on this device.');
    if(token)try{await request('/auth/v1/logout',{method:'POST'},token);}catch{say('Signed out locally. Server sign-out failed; this session expires automatically.');}
  });
})();
