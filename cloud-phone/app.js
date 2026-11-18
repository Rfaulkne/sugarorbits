/* Public project configuration. Never put secret/service-role keys here. */
(() => {
  'use strict';
  const URL = 'https://hinknpgmmhkqphsgvuek.supabase.co';
  const KEY = 'sb_publishable_M-0fIrNtiOrSOoDfpjh2TA_dUvGCRx_';
  const $ = id => document.getElementById(id);
  // In-memory session only for this initial test; reload requires signing in.
  // No password, token, health data or offline queue is persisted on this device.
  let session = null, refreshing = null, busy = false, generation = 0;
  let image = null, photoGeneration = 0, undoId = null, toastTimer, fadeTimer;
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
  }
  function toast(text,id=null) {
    clearTimeout(toastTimer);clearTimeout(fadeTimer);undoId=id;
    $('toast-label').textContent=text;$('undo').hidden=!id;$('toast').hidden=false;$('toast').classList.remove('fading');
    toastTimer=setTimeout(()=>{$('toast').classList.add('fading');fadeTimer=setTimeout(()=>{$('toast').hidden=true;undoId=null;},450);},id?8000:3000);
  }
  function clearPhoto() {
    photoGeneration++;image=null;$('photo').value='';$('photo-preview').hidden=true;$('photo-preview').removeAttribute('src');
    $('food-confirm').hidden=true;$('food-result').hidden=true;$('foods').value='';$('portion').value='';$('food-consent').checked=false;$('identify').disabled=true;
    $('carbs').textContent='';$('food-question').textContent='';$('assumptions').replaceChildren();
  }
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
  });};
  document.querySelectorAll('[data-kind]').forEach(button=>button.onclick=()=>run(async()=>{
    const id=crypto.randomUUID();
    await request('/rest/v1/orbit_events', {method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({id,kind:button.dataset.kind,occurred_at:new Date().toISOString()})}, await access());
    say('');toast('Logged ✓',id);
  }));
  $('undo').onclick=()=>run(async()=>{const id=undoId;if(!id)return;await request('/rest/v1/orbit_events?id=eq.'+encodeURIComponent(id),{method:'DELETE'},await access());toast('Removed ✓');});
  document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{
    for(const tab of ['log','coach','food'])$('panel-'+tab).hidden=tab!==button.dataset.tab;
    document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));say('');
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
        const scale=Math.min(1,1024/Math.max(picture.naturalWidth,picture.naturalHeight));const canvas=document.createElement('canvas');
        canvas.width=Math.round(picture.naturalWidth*scale);canvas.height=Math.round(picture.naturalHeight*scale);
        const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(picture,0,0,canvas.width,canvas.height);
        image=canvas.toDataURL('image/jpeg',.75);if(image.length>1400000)throw new Error('Please choose a smaller photo.');
        $('photo-preview').src=image;$('photo-preview').hidden=false;$('identify').disabled=false;say('Photo ready. Nothing has been sent yet.');
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
