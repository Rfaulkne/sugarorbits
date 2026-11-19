/* Public project configuration. Never put secret/service-role keys here. */
(() => {
  'use strict';
  const URL = 'https://hinknpgmmhkqphsgvuek.supabase.co';
  const KEY = 'sb_publishable_M-0fIrNtiOrSOoDfpjh2TA_dUvGCRx_';
  const $ = id => document.getElementById(id);
  // Session persistence is explicit opt-in on a personal device. Never store passwords/photos.
  let session = null, refreshing = null, busy = false, generation = 0;
  let image = null, photoGeneration = 0, undoId = null, toastTimer, fadeTimer;
  let cameraStream=null,cameraGeneration=0,editingStaples=false;
  let rhythmRows=[],rhythmEvents=[],rhythmState=null,orbit=null;
  let chosenSuggestion=null;
  let lenses=null;
  function drawLenses(){
    if(!window.OrbitLenses||!session)return;
    if(!lenses)lenses=new window.OrbitLenses.Lenses({getFocus:readFocus,onCoach:observation=>{setTab('focus');renderFocus();$('calm-coach-context').hidden=!observation;if(observation)$('calm-coach-context').textContent=observation.type==='tag'?'From Rhythm: after '+observation.kind+' · '+observation.label+'. Calculated association, not an AI verdict. Stress-tag focus tracking is not connected yet.':'From Rhythm: '+clock(observation.start)+'–'+clock(observation.end)+' · recurring '+(observation.kind==='high'?'highs':'lows')+'.';},onStart:(pattern,habit)=>run(async()=>{
      chosenSuggestion=null;$('focus-kind').value=pattern.kind;$('focus-window').value=String(pattern.start);$('focus-habit').value=habit;await startFocus();lenses.setMode('focus');
    })});
    lenses.update(rhythmState,rhythmEvents);
    const f=readFocus(),after=f?focusFacts?.after||focusMetrics(f):null;
    $('lens-focus-progress').textContent=f?'Selected window · before '+pct(f.baseline?.range)+' / during '+pct(after?.range)+' in range. '+(after?.eligible||0)+' covered windows during. Compare highs, lows and coverage in Coach.':'';
  }
  const R=window.OrbitRhythm;
  const A=window.OrbitAfterMoment;
  const F=window.OrbitFocusCore,SESSION_KEY='orbit-personal-session-v1';
  let remember=false,cloudReady=false,cloudKnown=false,cloudPlans=[],cloudConfig={},focusFacts=null;
  function persistSession(){try{if(remember&&session)localStorage.setItem(SESSION_KEY,JSON.stringify({access_token:session.access_token,refresh_token:session.refresh_token,expires_at:session.expires_at,user:{id:session.user.id}}));else localStorage.removeItem(SESSION_KEY);}catch{remember=false;$('remember-device').checked=false;say('This browser could not remember sign-in. The session is temporary.');}}
  async function focusCall(payload){return request('/functions/v1/orbit-focus',{method:'POST',body:JSON.stringify(payload)},await access());}
  function applyCloud(result){if(!Array.isArray(result?.plans))throw Error('Unexpected cloud focus response.');cloudPlans=result.plans;cloudReady=true;cloudKnown=true;focusFacts=null;renderFocus();renderKept();}
  async function loadCloudFocus(){
    const current=generation;
    try{const result=await focusCall({action:'list'});if(current!==generation)return;cloudConfig=result;applyCloud(result);$('cloud-focus-status').textContent='Cloud focus connected. Plans and check-ins expire 28 days after the plan began.';
      $('move-local-focus').hidden=!!readFocus()||!readLocalFocus();
    }catch{if(current!==generation)return;cloudReady=false;$('cloud-focus-status').textContent=cloudKnown?'Cloud focus is unavailable. Your last loaded plan is visible; saving is paused. Refresh before making changes.':'Cloud focus setup is pending. Existing device-only plans still work; reminders and cloud coaching are not active yet.';}
  }
  const currentRecord=()=>cloudPlans.find(r=>r.plan.status==='active');
  async function cloudAction(action,extra={},record=currentRecord()){
    if(!cloudReady)throw Error('Refresh cloud focus before saving.');
    const current=generation,result=await focusCall({action,...(record?{id:record.id,revision:record.revision}:{}),...extra});if(current!==generation)throw Error('Session changed.');applyCloud(result);return result;
  }
  function renderKept(){
    $('kept-list').replaceChildren();
    for(const record of cloudPlans.filter(r=>['maintaining','completed'].includes(r.plan.status))){const p=record.plan,card=document.createElement('article');card.className='card';
      const title=document.createElement('h3');title.textContent=p.reflection?.worked||p.habit;const note=document.createElement('p');note.className='hint';note.textContent='Your reflection—not an established cause. Reminder follows the original window. Expires '+new Date(record.expires_at).toLocaleDateString()+'.';
      const toggle=document.createElement('button');toggle.className='quiet';toggle.textContent=p.reminder?.enabled?'Pause keep-going reminder':'Enable weekly keep-going reminder';toggle.onclick=()=>run(async()=>{await cloudAction('reminder',{reminder:{...p.reminder,enabled:!p.reminder.enabled,frequency:7}},record);toast('Reminder preference saved ✓');});
      const remove=document.createElement('button');remove.className='quiet';remove.textContent='Remove saved reflection';remove.onclick=()=>run(async()=>{await cloudAction('delete',{},record);toast('Reflection removed');});card.append(title,note);if(p.status==='maintaining')card.append(toggle);card.append(remove);$('kept-list').append(card);
    }
  }
  let afterKind='all',afterHours=3,afterId=null,afterSequence=0,afterData=null;
  const momentName=e=>e.kind[0].toUpperCase()+e.kind.slice(1)+' · '+new Date(e.occurred_at).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  function clearAfter(){afterSequence++;afterData=null;A?.draw($('after-canvas'),null);$('after-canvas').setAttribute('aria-label','No trace displayed.');}
  function afterEvents(){return rhythmEvents.filter(e=>['activity','stress','other'].includes(e.kind)&&Number.isFinite(Date.parse(e.occurred_at))&&Date.parse(e.occurred_at)<=Date.now()&&(afterKind==='all'||e.kind===afterKind));}
  function renderAfter(){
    const list=afterEvents();if(!list.some(e=>e.id===afterId))afterId=list[0]?.id||null;
    $('after-event').replaceChildren();
    for(const event of list){const option=document.createElement('option');option.value=event.id;option.textContent=momentName(event);$('after-event').append(option);}
    $('after-event').value=afterId||'';$('after-event').disabled=!list.length;
    $('after-filters').replaceChildren();
    for(const kind of ['all','activity','stress','other']){const b=document.createElement('button');b.textContent=kind[0].toUpperCase()+kind.slice(1);b.setAttribute('aria-pressed',String(kind===afterKind));b.onclick=()=>{afterKind=kind;renderAfter();};$('after-filters').append(b);}
    $('after-durations').replaceChildren();
    for(const hours of [1,3,6]){const b=document.createElement('button');b.textContent=hours+'h';b.setAttribute('aria-pressed',String(hours===afterHours));b.onclick=()=>{afterHours=hours;renderAfter();};$('after-durations').append(b);}
    void loadAfter();
  }
  async function loadAfter(){
    clearAfter();const sequence=afterSequence,current=generation,event=afterEvents().find(e=>e.id===afterId);
    $('after-caption').textContent=event?momentName(event)+' · following '+afterHours+' hours':'';
    if(!session||!event){$('after-status').textContent=afterKind==='all'?'Log a moment to explore what follows.':'No saved '+afterKind+' moments in your most recent 20 taps.';return;}
    $('after-status').textContent='Loading this moment’s readings…';
    const start=Date.parse(event.occurred_at),hours=afterHours,now=Date.now(),end=Math.min(start+hours*3600000,now);
    try{const token=await access();if(sequence!==afterSequence||current!==generation)return;
      const rows=await request('/rest/v1/orbit_glucose?select=recorded_at,value_mg_dl&order=recorded_at.asc&limit=1000&recorded_at=gte.'+encodeURIComponent(new Date(start).toISOString())+'&recorded_at=lte.'+encodeURIComponent(new Date(end).toISOString()),{},token);
      if(sequence!==afterSequence||current!==generation)return;
      if(!Array.isArray(rows)||rows.length>=1000)throw new Error('Incomplete window');
      afterData=A?.trace(rows,start,hours,now);A?.draw($('after-canvas'),afterData);
      const points=afterData?.points||[];
      $('after-status').textContent=(points.length?points.length+' recorded readings. '+(points.length===1?'A single reading cannot show a path. ':''):'No recorded readings in this window yet. ')+(afterData?.pending?'The remaining window is still ahead; refresh later.':'This window has elapsed; blank areas mean missing recordings, not in-range readings.');
      $('after-canvas').setAttribute('aria-label',points.length?`Glucose after ${momentName(event)}. ${points.length} readings, ${points[0].v.toFixed(1)} to ${points.at(-1).v.toFixed(1)} mmol/L from first to last recorded sample. Gaps are not filled.`:'No recorded glucose readings after this moment.');
    }catch{if(sequence===afterSequence&&current===generation)$('after-status').textContent='Could not load this window. Tap Refresh this window to retry.';}
  }
  $('after-event').onchange=()=>{afterId=$('after-event').value;renderAfter();};
  $('after-refresh').onclick=()=>{void loadAfter();};
  window.addEventListener('resize',()=>{if(session)A?.draw($('after-canvas'),afterData);});
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
    if(remember&&navigator.locks?.request)return navigator.locks.request('orbit-personal-session',()=>accessUnlocked());
    return accessUnlocked();
  }
  async function accessUnlocked() {
    if (!session) throw new Error('Please sign in.');
    if(remember){try{const saved=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');if(saved?.user?.id===session.user.id&&saved.expires_at>session.expires_at)session=saved;}catch{}}
    if (session.expires_at * 1000 < Date.now() + 60000) {
      if (!refreshing) {
        const current = generation;
        refreshing = request('/auth/v1/token?grant_type=refresh_token', {
          method:'POST', body:JSON.stringify({refresh_token:session.refresh_token})
        }).then(data => {
          if (current !== generation) throw new Error('Session changed. Please sign in again.');
          session = data;persistSession(); return data;
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
    cloudReady=false;cloudKnown=false;cloudPlans=[];cloudConfig={};focusFacts=null;renderKept();$('focus-ai-answer').textContent='';$('focus-ai-ideas').replaceChildren();$('push-status').textContent='';$('cloud-focus-status').textContent='';$('move-local-focus').hidden=true;
    rhythmRows=[];rhythmEvents=[];rhythmState=null;afterKind='all';afterId=null;clearAfter();renderAfter();setTab(window.location?.hash==='#focus'?'focus':'rhythm');setQuickLog(true);
    lenses?.update(null);
    $('calm-coach-context').hidden=true;$('calm-coach-context').textContent='';
    for(const id of ['focus-habit','focus-note'])$(id).value='';
    for(const id of ['focus-title','focus-habit-copy','focus-progress','focus-comparison','focus-review-date','focus-checkin-status'])$(id).textContent='';
    $('rhythm-range').textContent='—';$('rhythm-coverage').textContent='Loading your recorded rhythm…';
    if(orbit)orbit.draw(null);renderFocus();
    resetCoach();
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
    remember=$('remember-device').checked;generation++;persistSession();showSession();say('Connected.');await loadCloudFocus();
    try{await refreshDexcom();}catch{$('dexcom-status').textContent='Could not load glucose status. Open Coach and try Refresh status.';}
    try{await loadRhythm();}catch{$('rhythm-coverage').textContent='Could not load the complete rhythm window. Use Refresh status below to retry. No pattern conclusions are shown.';}
  });};
  document.querySelectorAll('[data-kind]').forEach(button=>button.onclick=()=>run(async()=>{
    const id=crypto.randomUUID();
    const event={id,kind:button.dataset.kind,occurred_at:new Date().toISOString()};
    await request('/rest/v1/orbit_events', {method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(event)}, await access());
    rhythmEvents.unshift(event);rhythmEvents=rhythmEvents.slice(0,20);afterId=event.id;afterKind='all';paintRhythm();
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
  function readFocus(){const record=currentRecord();return cloudKnown?(record?{...record.plan,id:record.id,revision:record.revision,cloud:true}:null):readLocalFocus();}
  function readLocalFocus(){try{const f=JSON.parse(localStorage.getItem(focusKey())||'null');if(!f)return null;
    if(!['high','low','activity'].includes(f.kind)||!Number.isFinite(f.started)||f.started>Date.now()||Date.now()-f.started>28*864e5||typeof f.habit!=='string'||f.habit.length>160||!Number.isInteger(f.start)||f.start<0||f.start>1260){if(focusKey())localStorage.removeItem(focusKey());return null;}return f;
  }catch{return null;}}
  function saveFocus(f){const key=focusKey();if(!key)throw new Error('Sign in again before saving a focus.');localStorage.setItem(key,JSON.stringify(f));renderFocus();}
  function focusMetrics(f,baseline=false){if(!rhythmState||!R)return null;
    if(f.kind==='activity')return R.activityMetrics(rhythmState.all,rhythmEvents,baseline?f.started-7*864e5:f.started,baseline?f.started:Math.min(Date.now(),f.started+7*864e5));
    return R.metrics(baseline?rhythmState.current:rhythmState.all,f.start,f.start+180,baseline?-Infinity:f.started,baseline?f.started:Math.min(Date.now(),f.started+7*864e5));
  }
  function renderFocus(){
    const f=readFocus();$('focus-plan').hidden=!!f;$('focus-thread').hidden=!f;
    $('move-local-focus').hidden=!!f||!cloudReady||!readLocalFocus();
    $('active-reminder-controls').hidden=!f?.cloud;
    $('coach-new-options').hidden=!!f;$('coach-active-note').hidden=!f;
    $('coach-suggestions').hidden=!!f;
    $('focus-window-label').hidden=$('focus-kind').value==='activity';
    $('focus-reflection').hidden=true;
    if(!f){$('home-focus-title').textContent='What would you like to notice?';$('home-focus-description').textContent='Explore a pattern in Rhythm, or choose your own observation.';drawLenses();return;}
    const elapsed=Math.floor((Date.now()-f.started)/864e5),review=elapsed>=7;
    const title=f.kind==='activity'?'Around tagged activity':`${f.kind==='high'?'Above':'Below'} range · ${clock(f.start)}–${clock(f.start+180)}`;
    $('home-focus-title').textContent=title;$('home-focus-description').textContent=review?'Your seven-day reflection is ready to revisit.':`Day ${Math.min(7,elapsed+1)} of 7 · ${f.habit}`;
    $('focus-stage').textContent=review?'SEVEN-DAY REFLECTION':`DAY ${elapsed+1} OF 7`;$('focus-title').textContent=title;$('focus-habit-copy').textContent=f.habit;
    $('focus-review-date').textContent='Review from '+new Date(f.started+7*864e5).toLocaleDateString()+'. '+(f.cloud?'Saved to your private cloud account.':'Device-only plan; cloud setup pending.');
    const today=R?R.local(Date.now()).date:new Date().toISOString().slice(0,10),entry=f.checkins?.[today];
    const names={tried:'Tried it','not-today':'Not today',skip:'Skipped',note:'Thought saved'};
    $('focus-checkin-status').textContent=entry?(names[entry.status]||'Checked in')+' today. You can change it.':'No check-in needed to keep exploring.';$('focus-note').value=typeof entry?.note==='string'?entry.note:'';
    $('focus-prompt').textContent=review?'What did you notice? Continue, adjust or finish—there is no automatic “resolved” verdict.':'How did your chosen experiment fit today?';
    const current=focusFacts?.after||focusMetrics(f),base=focusFacts?.before||f.baseline;
    const describe=m=>m&&m.eligible?`${m.eligible} covered ${f.kind==='activity'?'activity windows':'days'} · ${pct(m.range)} in range · ${pct(m.high)} above · ${pct(m.low)} below`:'Not enough covered windows to describe yet.';
    $('focus-progress').textContent='Recorded samples — Before: '+describe(base)+' During: '+describe(current);
    const enough=base?.eligible>=5&&current?.eligible>=5;
    $('focus-comparison').textContent=(enough?'Both periods have at least five covered windows. These are descriptive observations, not evidence that your experiment caused a change.':'Comparison is provisional: at least five covered windows in each period are needed before interpreting a change.')+(f.kind==='activity'?' Activity means the two hours after a tag; overlapping tags are combined. Untagged activity is unknown.':' Only complete three-hour windows with at least 70% sample coverage are counted.');
    const outcome=focusFacts?.outcome||F?.evaluate(f.kind,base,current,Date.now()-f.started);
    $('focus-reflection').hidden=!review||!f.cloud;$('focus-outcome-title').textContent=outcome?.label||'What would you like to keep?';
    $('focus-tags').textContent=focusFacts?'Tags in this window during your focus: '+Object.entries(focusFacts.tags).map(([kind,n])=>kind+' '+n).join(' · ')+'. Only your retained 20 taps are available; untagged context is unknown.':'Update progress to read the complete server-side window and tag counts.';
    const r=f.reminder||{};$('reminder-enabled').checked=!!r.enabled;$('reminder-lead').value=String(r.lead??15);$('reminder-time').value=clock(r.minute??1080);$('quiet-start').value=clock(r.quiet_start??1320);$('quiet-end').value=clock(r.quiet_end??480);
    drawLenses();
  }
  function resetCoach(){chosenSuggestion=null;$('coach-suggestions').replaceChildren();$('coach-status').textContent='';$('selected-focus-note').hidden=true;}
  const candidateTitle=c=>c.kind==='activity'?'Around tagged activity':`${c.kind==='high'?'Above':'Below'} range · ${clock(c.start)}–${clock(c.end)}`;
  function validateChoice(c){
    const validFraction=n=>n===null||typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1;
    return c&&['high','low','activity'].includes(c.kind)&&typeof c.id==='string'&&typeof c.question==='string'&&c.question.length>0&&c.question.length<=240&&
      (c.kind==='activity'?c.id==='activity'&&c.start===0&&c.end===1440:Number.isInteger(c.start)&&c.start>=0&&c.start<=1260&&c.start%180===0&&c.end===c.start+180&&c.id===c.kind+'-'+c.start)&&
      [c.current,c.previous].every(m=>m&&Number.isInteger(m.eligible)&&m.eligible>=0&&m.eligible<=20&&[m.above,m.below,m.in_range].every(validFraction))&&c.current.eligible>=3;
  }
  $('coach-find').onclick=()=>run(async()=>{
    if(readFocus())throw new Error('Finish the current focus before choosing another.');
    $('coach-status').textContent='Checking coverage and preparing a few choices…';$('coach-suggestions').replaceChildren();chosenSuggestion=null;$('selected-focus-note').hidden=true;
    try{
      const result=await request('/functions/v1/orbit-coach',{method:'POST',body:JSON.stringify({consent:true})},await access());
      if(['insufficient_data','stale_data'].includes(result.mode)){$('coach-status').textContent=result.message||'Not enough recent covered data yet. You can choose an observation yourself.';return;}
      const generated=Date.parse(result.generated_at),choices=result.suggestions;
      if(result.mode!=='ai_assisted'||!Number.isFinite(generated)||generated>Date.now()+60000||Date.now()-generated>15*60000||!Array.isArray(choices)||choices.length<1||choices.length>3||!choices.every(validateChoice)||new Set(choices.map(c=>c.id)).size!==choices.length)throw new Error('The AI choices could not be validated. Nothing was selected.');
      $('coach-status').textContent='AI-assisted choices, backed by calculated observations. Choose only what feels useful.';
      for(const c of choices){
        const card=document.createElement('article');card.className='coach-choice';const title=document.createElement('h3');title.textContent=candidateTitle(c);
        const question=document.createElement('p');question.textContent=c.question;const facts=document.createElement('p');facts.className='hint';
        const affected=c.kind==='high'?c.current.affected_high_days:c.current.affected_low_days;
        facts.textContent=(c.kind==='activity'?`${c.current.eligible} covered tagged windows`: `${Number.isInteger(affected)?affected:'—'} of ${c.current.eligible} covered days affected`)+` · ${pct(c.current.in_range)} in range · ${pct(c.current.above)} above · ${pct(c.current.below)} below.`+(c.preliminary?' Preliminary coverage.':'');
        if(c.tag_context)facts.textContent+=' Tags recorded in this window: '+['activity','stress','other'].map(k=>k+' '+(Number.isInteger(c.tag_context[k])?c.tag_context[k]:0)).join(' · ')+'. Incomplete context, not causes.';
        const reference=document.createElement('p');reference.className='hint';reference.textContent=c.previous.eligible>=3?`Preceding period: ${c.previous.eligible} covered windows · ${pct(c.previous.in_range)} in range. This is context, not a causal comparison.`:'Preceding period has too few covered windows for a useful comparison.';
        const choose=document.createElement('button');choose.textContent='Choose this focus';choose.onclick=()=>{if(busy)return;
          if(Date.now()-generated>15*60000){$('coach-status').textContent='These choices are over 15 minutes old. Request a fresh review.';return;}
          chosenSuggestion={id:c.id,kind:c.kind,start:c.kind==='activity'?0:c.start,generated};$('focus-kind').value=c.kind;$('focus-window').value=String(c.kind==='activity'?0:c.start);$('focus-window-label').hidden=c.kind==='activity';
          $('selected-focus-note').textContent='Chosen: '+candidateTitle(c)+'. Now describe what you want to try or observe.';$('selected-focus-note').hidden=false;$('focus-plan').scrollIntoView?.({behavior:'smooth',block:'start'});
        };
        card.append(title,question,facts,reference,choose);$('coach-suggestions').append(card);
      }
    }catch(error){$('coach-status').textContent=error.message;throw error;}
  });
  const clearSelection=()=>{chosenSuggestion=null;$('selected-focus-note').hidden=true;};
  $('focus-kind').onchange=()=>{clearSelection();$('focus-window-label').hidden=$('focus-kind').value==='activity';};
  $('focus-window').onchange=clearSelection;
  $('habit-ideas').onclick=event=>{const id=event.target?.dataset?.experiment;const ideas={tag:'Tag what is happening during this window.',routine:'Notice whether my routine differs on these days.',team:'Bring this recurring window to my diabetes team.'};if(!busy&&ideas[id])$('focus-habit').value=ideas[id];};
  $('focus-plan').onsubmit=event=>{event.preventDefault();run(startFocus);};
  async function startFocus(){
    if(readFocus())throw new Error('Finish the current focus before starting another.');
    const habit=$('focus-habit').value.trim();if(!habit)throw new Error('Describe one thing you will try or observe.');
    if(chosenSuggestion){if(Date.now()-chosenSuggestion.generated>15*60000)throw new Error('Request fresh AI choices before starting this focus.');await loadRhythm();}
    const f={started:Date.now(),kind:$('focus-kind').value,start:Number($('focus-window').value),habit,checkins:{}};
    f.baseline=focusMetrics(f,true);
    if(chosenSuggestion){if(!f.baseline||f.baseline.eligible<3)throw new Error('The latest baseline has insufficient coverage. Request a fresh review.');f.suggestion_id=chosenSuggestion.id;}
    if(cloudKnown){await cloudAction('start',{kind:f.kind,start:f.start,habit:f.habit},null);toast('Focus saved to your account ✓');}
    else{saveFocus(f);toast('Focus saved on this phone only ✓');}resetCoach();
  }
  async function checkIn(status){const f=readFocus();if(!f)return;const date=R?R.local(Date.now()).date:new Date().toISOString().slice(0,10);f.checkins=f.checkins||{};const entry={status:status||f.checkins[date]?.status||'note',note:$('focus-note').value.slice(0,240)};if(f.cloud)await cloudAction('checkin',entry);else{f.checkins[date]=entry;saveFocus(f);}toast('Check-in saved ✓');}
  document.querySelectorAll('[data-checkin]').forEach(b=>b.onclick=()=>run(async()=>checkIn(b.dataset.checkin)));
  $('save-focus-note').onclick=()=>run(async()=>checkIn(null));
  $('finish-focus').onclick=()=>run(async()=>{if(readFocus()?.cloud)await cloudAction('finish');else{const key=focusKey();if(key)localStorage.removeItem(key);}resetCoach();renderFocus();toast('Focus finished');});
  $('refresh-focus').onclick=()=>run(async()=>{await loadCloudFocus();if(cloudReady&&readFocus())await reviewCloud();});
  async function reviewCloud(){const f=readFocus(),current=generation;if(!f?.cloud)throw Error('Progress updates need the cloud focus setup.');const result=await focusCall({action:'review',id:f.id});if(current!==generation||readFocus()?.id!==f.id)return;focusFacts=result.facts;renderFocus();}
  $('focus-review').onclick=()=>run(reviewCloud);
  $('focus-ask').onclick=()=>run(async()=>{const f=readFocus(),current=generation;if(!f?.cloud)throw Error('Deploy the cloud focus function first.');$('focus-ai-answer').textContent='Taking a small look…';$('focus-ai-ideas').replaceChildren();const result=await focusCall({action:'coach',id:f.id,consent:true});if(current!==generation||readFocus()?.id!==f.id)return;focusFacts=result.facts;renderFocus();$('focus-ai-answer').textContent=result.question;
    for(const idea of result.ideas||[]){const p=document.createElement('p');p.className='hint';p.textContent=idea;$('focus-ai-ideas').append(p);}
  });
  $('keep-focus').onclick=()=>run(async()=>{await cloudAction('reflect',{worked:$('focus-worked').value.trim()});$('focus-worked').value='';toast('Saved what you found useful ✓');});
  const minutes=value=>{const [h,m]=value.split(':').map(Number);return h*60+m;};
  $('save-reminder').onclick=()=>run(async()=>{await cloudAction('reminder',{reminder:{enabled:$('reminder-enabled').checked,lead:Number($('reminder-lead').value),minute:minutes($('reminder-time').value),quiet_start:minutes($('quiet-start').value),quiet_end:minutes($('quiet-end').value),frequency:1}});toast('Focus reminder preference saved ✓');});
  $('push-enable').onclick=()=>run(async()=>{$('push-status').textContent=await window.OrbitPWA.enable(cloudConfig,focusCall);});
  $('push-disable').onclick=()=>run(async()=>{await window.OrbitPWA.disable(focusCall);$('push-status').textContent='This phone is unsubscribed. Your focus plans are unchanged.';});
  $('move-local-focus').onclick=()=>run(async()=>{const f=readLocalFocus();if(!f||!cloudReady)return;await cloudAction('start',{kind:f.kind,start:f.start,habit:f.habit},null);localStorage.removeItem(focusKey());$('move-local-focus').hidden=true;toast('Started a new cloud week. Old dates were not backdated.');});
  function paintRhythm(){
    if(!R||!session)return;rhythmState=R.summarize(rhythmRows,rhythmEvents);
    $('rhythm-range').textContent=pct(rhythmState.rangeFraction);
    $('rhythm-period').textContent=R.shift(rhythmState.today,-7)+' to '+R.shift(rhythmState.today,-1)+' · Europe/Berlin';
    const bins=rhythmState.profile.filter(p=>p.mean!==null).length;
    $('rhythm-coverage').textContent=`${rhythmState.coveredDates} of 7 completed days have recorded samples; ${bins} of 48 clock sections can be drawn. `+(rhythmState.coveredDates<5?'Building a picture—do not interpret this as an established pattern.':'Averages describe available recordings; gaps and incomplete days can affect the shape.');
    if(!window.OrbitLenses&&window.OrbitCanvas){if(!orbit)orbit=new window.OrbitCanvas($('rhythm-canvas'),{mini:true});orbit.draw(rhythmState);}
    let observations=[];for(let start=0;start<1440;start+=180){const m=R.metrics(rhythmState.current,start,start+180);if(m.eligible>=3){for(const [key,name]of [['affectedHigh','above'],['affectedLow','below']])if(m[key]>=3)observations.push(`${clock(start)}–${clock(start+180)}: 3 consecutive five-minute samples ${name} range on ${m[key]} of ${m.eligible} covered days.`);}}
    $('focus-observation').textContent=observations.length?observations.slice(0,2).join(' ')+' Observations, not explanations.':'No recurring period meets the current minimum of three affected, adequately covered days. You can still choose something to observe.';
    renderFocus();renderAfter();
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
  window.addEventListener('resize',()=>{if(!lenses&&orbit&&rhythmState&&session)orbit.draw(rhythmState);});
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
    let pushFailure=false;try{await window.OrbitPWA?.disable(focusCall);}catch{pushFailure=true;}
    const token=session?.access_token;session=null;remember=false;generation++;persistSession();showSession();say(pushFailure?'Signed out. Device reminder removal was not confirmed; disable Sugar Orbits notifications in iPhone Settings if needed.':'Signed out on this device.');
    if(token)try{await request('/auth/v1/logout',{method:'POST'},token);}catch{say('Signed out locally. Server sign-out failed; this session expires automatically.');}
  });
  window.addEventListener('hashchange',()=>{if(session&&window.location?.hash==='#focus')setTab('focus');});
  window.addEventListener('storage',event=>{if(event.key===SESSION_KEY&&!event.newValue&&remember){session=null;remember=false;generation++;showSession();say('Signed out in another window.');}});
  async function restoreSession(){
    let saved;try{saved=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');}catch{return;}
    if(!saved?.access_token||!saved?.refresh_token||!saved?.user?.id||!Number.isFinite(saved.expires_at))return;
    await run(async()=>{remember=true;session=saved;
      try{const token=await access(),user=await request('/auth/v1/user',{},token);if(!user?.id)throw Error('Session expired.');session.user={id:user.id};persistSession();generation++;showSession();$('remember-device').checked=true;}
      catch{session=null;remember=false;generation++;persistSession();showSession();say('Please sign in again. Your saved cloud data is unchanged.');return;}
      await loadCloudFocus();
      try{await refreshDexcom();await loadRhythm();say('Welcome back.');}catch{say('Signed in. Data refresh is unavailable; try Refresh status when connected.');}
    });
  }
  void restoreSession();
})();
