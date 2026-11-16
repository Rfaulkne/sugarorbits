(() => {
  'use strict';
  const C=window.OrbitClient,$=s=>document.querySelector(s),el=C.el;
  const mini=new OrbitCanvas($('#pocket-orbit'),{mini:true});let state=null,selectedCandidate=null,image=null,refreshTask=Promise.resolve();
  const kindNames={activity:'Activity',stress:'Stress',other:'Other',food:'Food'};
  const symbols={activity:'↗',stress:'≈',other:'＋',food:'▧'};
  const pct=x=>x===null?'—':Math.round(x*100)+'%';
  function tab(name){document.querySelectorAll('.phone-tab').forEach(s=>s.hidden=s.id!=='tab-'+name);document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));window.scrollTo(0,0);if(name==='log')mini.draw(state);}
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
  function button(text,action,cls='text-button'){const b=el('button',cls,text);b.type='button';b.onclick=()=>Promise.resolve(action()).catch(e=>C.toast(e.message));return b;}
  function dots(f){const row=el('div','week-dots');const start=new Date(f.startedAt);for(let i=0;i<7;i++){const d=new Date(start.getTime()+i*864e5);const day=new Intl.DateTimeFormat('en-CA',{timeZone:state.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);const status=f.checkins.find(c=>c.day===day)?.status;const dot=el('span',status||'unanswered');dot.title=day+' · '+(status||'not checked in');row.append(dot);}return row;}
  function checkinButtons(f){const row=el('div','checkin-buttons'),today=f.checkins.find(c=>c.day===state.today)?.status;for(const [status,label] of [['done','Done'],['partly','Partly'],['not_today','Not today']]){const b=button(label,async()=>{await C.post('checkin',{focusId:f.id,day:state.today,status});await refresh();C.toast('Check-in saved. No explanation needed.');},today===status?'selected':'');row.append(b);}return row;}
  function renderFocus(){
    const compact=$('#today-focus'),full=$('#active-focus');compact.replaceChildren();full.replaceChildren();
    const f=state.focus;$('#focus-options').hidden=!!f;$('#focus-form').hidden=!!f||$('#focus-form').hidden;$('#review-dot').hidden=!f?.reviewDue;
    if(!f){compact.append(el('p','eyebrow','ONE SMALL FOCUS'),el('h2','','What would you like to notice?'),el('p','fineprint','Choose one period of your day. No scores, no perfect streaks.'),button('Find a focus →',()=>tab('focus')));return;}
    compact.append(el('p','eyebrow',f.reviewDue?'A REFLECTION IS READY':`YOUR FOCUS · DAY ${Math.min(7,f.elapsedDays+1)} OF 7`),el('h2','focus-title',f.habit),el('p','fineprint',C.clock(f.start)+'–'+C.clock(f.end)),dots(f));
    if(f.reviewDue)compact.append(button('Review my week →',()=>tab('focus')));else compact.append(checkinButtons(f));
    const card=el('article','card');card.append(el('p','eyebrow',f.reviewDue?'YOUR SEVEN-DAY REFLECTION':'YOUR ACTIVE FOCUS'),el('h2','focus-title',f.habit),el('p','fineprint',C.clock(f.start)+'–'+C.clock(f.end)+' · started '+C.date(f.startedAt)),dots(f));
    if(!f.reviewDue){card.append(el('p','',"How did it fit today?"),checkinButtons(f),el('p','fineprint',`${f.doneDays} completed check-ins. An unanswered day is simply unknown.`));}
    else{
      const metrics=el('div','stat-pair');for(const [title,s] of [['Baseline',f.baseline],['Focus week',f.followup]]){const block=el('div');block.append(el('span','',title),el('strong','',pct(s.highFraction)+' above'),el('span','',pct(s.lowFraction)+' below'),el('span','',s.validDays+' covered days'));metrics.append(block);}card.append(metrics,el('p','fineprint',f.enoughToCompare?'An early signal, not proof that the habit caused a change. Compare both highs and lows; missing data and an unusually difficult baseline can distort the result.':'Not enough comparable days for a glucose conclusion. Your experience with the habit still matters.'),el('p','',`You marked the habit done on ${f.doneDays} days. How did that feel?`));
      if(f.reflection)card.append(el('p','fineprint','Your reflection: '+f.reflection));
      for(const text of ['It fitted my routine','It was hard to maintain','I’m not sure'])card.append(button(text,async()=>{await C.post('reflection',{focusId:f.id,note:text});await refresh();C.toast('Reflection saved. You can stop or start a fresh week.');}));
      card.append(button('Continue as a fresh seven-day focus',async()=>{await C.post('focus/renew',{id:f.id});await refresh();},'secondary'));
    }
    card.append(button('Finish / stop this focus',async()=>{if(!window.confirm('Finish this focus? Your event tags will stay; the active focus will stop.'))return;await C.post('focus/finish',{id:f.id});await refresh();}));full.append(card);
  }
  function renderCandidates(){
    const box=$('#candidates');box.replaceChildren();
    for(const c of state.candidates){const b=button('',()=>openFocus(c),'candidate');b.append(el('span','eyebrow '+c.kind,c.kind==='high'?'A REPEATED HIGH PERIOD':'A REPEATED LOW PERIOD'),el('strong','',C.clock(c.start)+'–'+C.clock(c.end)),el('p','',`${c.stats[c.kind+'Days']} of ${c.stats.validDays} covered days · at least 15 consecutive observed minutes`));if(c.kind==='low')b.append(el('p','fineprint','Not an alert. Review recurrent lows with your usual diabetes care.'));box.append(b);}
    if(!state.candidates.length)box.append(el('p','empty-state','No repeated window meets the threshold yet. More observation is useful too.'));
  }
  function renderEvents(){
    const box=$('#events');box.replaceChildren();const pending=C.demo?[]:C.pending();const events=[...pending.map(e=>({...e,queued:true})),...state.events.filter(e=>!pending.some(p=>p.id===e.id))].sort((a,b)=>b.at.localeCompare(a.at));
    $('#event-count').textContent=state.events.length+' / 20'+(pending.length?' · '+pending.length+' unsent':'');
    if(!events.length){box.append(el('p','empty-state','Your next small moment goes here.\nActivity, stress, or something worth remembering.'));return;}
    for(const e of events){const row=el('div','event-row');row.append(el('span','tag-icon '+e.kind,symbols[e.kind]));const copy=el('div','event-copy');copy.append(el('strong','',kindNames[e.kind]+(e.carbs!==null&&e.carbs!==undefined?' · '+e.carbs+' g carbs':'')),el('p','',C.date(e.at,{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+(e.queued?' · waiting to sync':'')));if(e.note)copy.append(el('p','',e.note));const remove=button('×',async()=>{const result=await C.remove(e.id);await refresh();C.toast(result.queued?'Removal queued. The Pi updates after reconnecting.':'Event removed from the Pi.');});remove.setAttribute('aria-label','Remove '+kindNames[e.kind]+' event');row.append(copy,remove);box.append(row);}
  }
  function render(s){
    state=s;$('#demo-banner').hidden=!s.demo;$('#display-link').href='/rhythm'+(s.demo?'?demo=1':'');$('#connection').textContent=s.demo?'demo preview':s.stale?'Pi online · CGM delayed':'linked to your Pi';$('#connection').classList.toggle('offline',s.stale&&!s.demo);
    $('#mini-mean').textContent=s.weekStats.mean?.toFixed(1)??'—';mini.draw(s);$('#guide-question').textContent=s.guide.question;$('#guide-source').textContent='LOCAL GUIDE · NOT AI';
    $('#coach-button').disabled=!s.aiEnabled;$('#coach-consent-label').hidden=!s.aiEnabled;
    const msg=s.aiEnabled?'Optional cloud wording · only when you ask.':'Cloud AI is off. Local pattern questions and check-ins are fully available.';$('#ai-status').textContent=msg;$('#food-ai-status').textContent=s.aiEnabled?'Cloud photo drafts are optional and experimental.':'Photo analysis needs an optional API key on the Pi. The label calculator and manual food log work now.';$('#food-analyse').disabled=!s.aiEnabled;
    renderFocus();renderCandidates();renderEvents();
  }
  C.onChange=render;
  function refresh(){
    // Serialize reads instead of dropping a mutation's refresh while an older
    // request is in flight. Otherwise a new tag/focus can appear to disappear.
    refreshTask=refreshTask.catch(()=>{}).then(async()=>{try{await C.refresh();await C.flush();await C.refresh();$('#network-banner').hidden=true;}catch(e){$('#connection').textContent='not connected';$('#connection').classList.add('offline');$('#network-banner').hidden=false;$('#network-banner').textContent=e.message+' Unsent event tags stay on this phone. Nothing is marked synced until the Pi confirms.';if(e.status===401){const a=el('a','',' Unlock on this phone →');a.href='/unlock?next=/phone';$('#network-banner').append(a);}}});
    return refreshTask;
  }
  async function log(kind,extra={}){const event={id:C.id(),kind,at:new Date().toISOString(),note:'',...extra};const saved=await C.log(event);if(saved.queued){C.toast('Waiting to sync · saved only on this phone.',async()=>{await C.remove(event.id);if(state)renderEvents();});if(state)renderEvents();}else{await refresh();C.toast(kindNames[kind]+' marked. Carry on.',async()=>{await C.remove(event.id);await refresh();});}}
  document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>log(b.dataset.quick).catch(e=>C.toast(e.message)));
  $('#earlier-button').onclick=()=>{const now=new Date();now.setMinutes(now.getMinutes()-now.getTimezoneOffset());$('#event-at').value=now.toISOString().slice(0,16);$('#event-note').value='';$('#event-dialog').showModal();};$('#event-cancel').onclick=()=>$('#event-dialog').close();
  $('#event-form').onsubmit=async e=>{e.preventDefault();try{const at=new Date($('#event-at').value);if(Number.isNaN(at.getTime()))throw new Error('Choose a valid time.');await log($('#event-kind').value,{at:at.toISOString(),note:$('#event-note').value});$('#event-dialog').close();}catch(error){C.toast(error.message);}};
  for(let m=0;m<=1440;m+=30){if(m<1440){const o=el('option','',C.clock(m));o.value=m;$('#focus-start').append(o);}if(m>0){const o=el('option','',C.clock(m));o.value=m;$('#focus-end').append(o);}}
  function openFocus(c){selectedCandidate=c;$('#focus-start').value=c?.start??720;$('#focus-end').value=c?.end??900;$('#focus-form').hidden=false;$('#focus-form').scrollIntoView({block:'start',behavior:'smooth'});}
  $('#custom-focus').onclick=()=>openFocus(null);$('#focus-cancel').onclick=()=>$('#focus-form').hidden=true;
  document.querySelectorAll('[data-habit]').forEach(b=>b.onclick=()=>$('#habit').value=b.dataset.habit);
  $('#focus-form').onsubmit=async e=>{e.preventDefault();try{await C.post('focus',{start:+$('#focus-start').value,end:+$('#focus-end').value,kind:selectedCandidate?.kind||'observe',habit:$('#habit').value});$('#focus-form').hidden=true;await refresh();C.toast('One focus, seven days. You set the pace.');}catch(error){C.toast(error.message);}};
  $('#coach-button').onclick=async()=>{if(!$('#coach-consent').checked){C.toast('Confirm sharing the aggregate counts for this request first.');return;}const b=$('#coach-button');b.disabled=true;try{const result=await C.post('coach',{consent:true});$('#guide-source').textContent='AI WORDING · LOCAL EVIDENCE';$('#guide-question').textContent=result.question;}catch(e){C.toast(e.message);}finally{b.disabled=!state?.aiEnabled;$('#coach-consent').checked=false;}};
  $('#clear-pending').onclick=()=>{if(window.confirm('Delete unsent events from this phone? Synced events on the Pi are not changed.')){C.clearPending();if(state)renderEvents();C.toast('Unsent events cleared from this phone.');}};
  // File input works without getUserMedia. Re-encoding strips EXIF/location data.
  $('#food-photo').onchange=async e=>{image=null;$('#food-consent').checked=false;$('#food-draft').replaceChildren();const file=e.target.files[0];if(!file)return;if(file.size>20*1024*1024){C.toast('Choose a photo under 20 MB.');return;}const url=URL.createObjectURL(file);try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const scale=Math.min(1,1024/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);image=canvas.toDataURL('image/jpeg',.75);if(image.length>1600000)throw new Error('Photo is still too large. Choose a smaller one.');$('#food-preview').src=image;$('#food-preview').hidden=false;}catch{C.toast('This photo could not be opened. Try a JPEG or take a new photo.');$('#food-preview').hidden=true;}finally{URL.revokeObjectURL(url);}};
  $('#food-analyse').onclick=async()=>{if(!image){C.toast('Choose a photo first.');return;}if(!$('#food-consent').checked){C.toast('Confirm sharing this photo for analysis first.');return;}const b=$('#food-analyse');b.disabled=true;b.textContent='Taking a second look…';try{const result=await C.post('food-draft',{image,portion:$('#food-portion').value,consent:true});const out=$('#food-draft');out.replaceChildren();out.append(el('p','eyebrow','AI DRAFT · NOT VERIFIED'));if(result.totalRange)out.append(el('p','draft-range',`${result.totalRange[0]}–${result.totalRange[1]} g`));out.append(el('p','',result.question));const list=el('ul');for(const item of result.items){const li=el('li');li.append(el('strong','',item.food+(item.carbsLow===null?'':` · ${item.carbsLow}–${item.carbsHigh} g`)),el('br'),document.createTextNode(item.assumption));list.append(li);}out.append(list,el('p','fineprint',result.warning));}catch(e){C.toast(e.message);}finally{b.disabled=!state?.aiEnabled;b.textContent='Get an editable draft';$('#food-consent').checked=false;}};
  function labelAmount(){const w=$('#portion-weight').value,d=$('#carbs-density').value;if(w===''||d==='')return null;const value=+w * +d / 100;return Number.isFinite(value)&&+w>=0&&+w<=5000&&+d>=0&&+d<=100?value:null;}
  for(const id of ['#portion-weight','#carbs-density'])$(id).oninput=()=>$('#label-result').textContent=(labelAmount()===null?'—':labelAmount().toFixed(1))+' g carbohydrate';
  $('#use-label').onclick=()=>{const result=labelAmount();if(result===null||result>500){C.toast('Check the weight and label values first.');return;}$('#confirmed-carbs').value=result.toFixed(1);$('#carbs-checked').checked=false;$('#food-save').scrollIntoView({behavior:'smooth'});};
  $('#food-save').onsubmit=async e=>{e.preventDefault();if(!$('#carbs-checked').checked)return;try{await log('food',{carbs:+$('#confirmed-carbs').value,note:$('#food-note').value});$('#carbs-checked').checked=false;$('#confirmed-carbs').value='';}catch(error){C.toast(error.message);}};
  refresh();setInterval(()=>{if(!document.hidden)refresh();},30000);window.addEventListener('resize',()=>mini.draw(state));
  if('serviceWorker' in navigator && window.isSecureContext)navigator.serviceWorker.register('/focus-sw.js',{scope:'/phone'}).catch(()=>{});
})();
