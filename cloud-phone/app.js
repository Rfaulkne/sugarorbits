/* Public project configuration. Never put secret/service-role keys here. */
(() => {
  'use strict';
  const URL = 'https://hinknpgmmhkqphsgvuek.supabase.co';
  const KEY = 'sb_publishable_M-0fIrNtiOrSOoDfpjh2TA_dUvGCRx_';
  const $ = id => document.getElementById(id);
  // In-memory session only for this initial test; reload requires signing in.
  // No password, token, health data or offline queue is persisted on this device.
  let session = null, refreshing = null, busy = false, generation = 0;
  const say = text => { $('status').textContent = text; };
  async function request(path, options = {}, token) {
    const response = await fetch(URL + path, {...options, cache:'no-store',
      headers:{apikey:KEY, ...(token ? {Authorization:'Bearer ' + token} : {}),
        'Content-Type':'application/json', ...options.headers}, signal:AbortSignal.timeout(15000)});
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
    $('events').replaceChildren();
  }
  async function render() {
    const current = generation;
    const token = await access();
    const cutoff = new Date(Date.now() - 28*864e5).toISOString();
    const events = await request('/rest/v1/orbit_events?select=id,kind,occurred_at&order=occurred_at.desc&limit=20&occurred_at=gte.' + encodeURIComponent(cutoff), {}, token);
    if (current !== generation) return;
    $('events').replaceChildren();
    if (!events.length) {const li=document.createElement('li');li.textContent='A fresh start. Tap a moment above.';$('events').append(li);}
    for (const event of events) {
      const li=document.createElement('li'),label=document.createElement('div'),time=document.createElement('time'),remove=document.createElement('button');
      label.textContent=event.kind.charAt(0).toUpperCase()+event.kind.slice(1);
      time.dateTime=event.occurred_at;time.textContent=new Date(event.occurred_at).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
      label.append(time);remove.textContent='Remove';remove.className='quiet';remove.setAttribute('aria-label','Remove '+event.kind+' '+time.textContent);
      remove.onclick=()=>run(async()=>{await request('/rest/v1/orbit_events?id=eq.'+encodeURIComponent(event.id), {method:'DELETE'}, await access());await render();say('Moment removed.');});
      li.append(label,remove);$('events').append(li);
    }
  }
  async function run(fn) {
    if (busy) return;busy=true;
    document.querySelectorAll('button').forEach(b=>b.disabled=true);
    try {await fn();} catch(error) {say(error.name==='TimeoutError' ? 'Connection timed out. Refresh before retrying; your moment may have saved.' : error.message);}
    finally {busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}
  }
  $('login-form').onsubmit=event=>{event.preventDefault();run(async()=>{
    say('Signing in…');
    const password=$('password').value;$('password').value='';
    session=await request('/auth/v1/token?grant_type=password', {method:'POST',body:JSON.stringify({email:$('email').value.trim(),password})});
    generation++;showSession();await render();say('Connected. Your moments are private to your account.');
  });};
  document.querySelectorAll('[data-kind]').forEach(button=>button.onclick=()=>run(async()=>{
    const id=crypto.randomUUID();
    await request('/rest/v1/orbit_events', {method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({id,kind:button.dataset.kind,occurred_at:new Date().toISOString()})}, await access());
    say(button.textContent.trim()+' saved.');await render();
  }));
  $('refresh').onclick=()=>run(async()=>{await render();say('Up to date.');});
  $('logout').onclick=()=>run(async()=>{
    const token=session?.access_token;session=null;generation++;showSession();say('Signed out on this device.');
    if(token)try{await request('/auth/v1/logout',{method:'POST'},token);}catch{say('Signed out locally. Server sign-out failed; this session expires automatically.');}
  });
})();
