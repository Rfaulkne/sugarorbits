(() => {
  'use strict';
  const demo = new URLSearchParams(location.search).get('demo') === '1';
  const QUEUE = 'sugar-orbits-pending-v2';
  const client = window.OrbitClient = {demo, state: null, onChange: null};
  const readQueue = () => {try {const q = JSON.parse(localStorage.getItem(QUEUE) || '[]'); return Array.isArray(q) ? q.filter(e => Date.parse(e.at) > Date.now() - 28 * 864e5).slice(-40) : [];} catch {return [];}};
  const writeQueue = q => localStorage.setItem(QUEUE, JSON.stringify(q));
  client.pending = () => readQueue().filter(e=>e.action!=='delete');
  client.clearPending = () => writeQueue([]);
  client.id = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {const r = Math.random()*16|0; return (c === 'x' ? r : (r&3|8)).toString(16);});
  client.get = async () => {
    const response = await fetch('/api/v2/state' + (demo ? '?demo=1' : ''), {cache:'no-store'});
    const data = await response.json();
    if (!response.ok) {const error=new Error(data.message || 'Unlock the app, then return to this page.');error.status=response.status;throw error;}
    client.state = data; return data;
  };
  client.post = async (path, data) => {
    if (demo) throw new Error('Synthetic preview only. Open the page without ?demo=1 to save real events.');
    if (!client.state) await client.get();
    const response = await fetch('/api/v2/' + path, {method:'POST',headers:{'Content-Type':'application/json','X-Orbit-CSRF':client.state.csrf},body:JSON.stringify(data)});
    const result = await response.json();
    if (!response.ok) {const error = new Error(result.message || 'The request could not be completed.'); error.status = response.status; throw error;}
    return result;
  };
  let flushing = false;
  client.flush = async () => {
    if (demo || flushing || !client.state) return;
    flushing = true;
    try {
      for (const event of readQueue()) {
        await client.post(event.action==='delete'?'events/delete':'events', event);
        writeQueue(readQueue().filter(e => e.id !== event.id || e.action !== event.action));
      }
    } finally {flushing = false;}
  };
  client.log = async event => {
    if (demo) throw new Error('This is a synthetic preview. No events are saved.');
    const queue = readQueue();
    if (queue.length >= 20) throw new Error('20 pending changes are waiting. Reconnect to the Pi first.');
    writeQueue([...queue, event]);
    try {await client.flush();} catch (error) {if (error.status && error.status < 500) {writeQueue(readQueue().filter(e => e.id !== event.id));throw error;}}
    return {queued:readQueue().some(e => e.id === event.id)};
  };
  client.remove = async id => {
    // Persist a tombstone: a lost network response may have saved an apparent
    // "unsent" tag on the Pi. Retry deletion after reconnect, too.
    const q=readQueue().filter(e=>e.id!==id);
    if(q.length>=40)throw new Error('Reconnect to the Pi before making more changes.');
    writeQueue([...q,{id,at:new Date().toISOString(),action:'delete'}]);
    try{await client.flush();}catch(error){if(error.status&&error.status<500)throw error;}
    return {queued:readQueue().some(e=>e.id===id)};
  };
  client.clock = minute => `${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
  client.date = (value, options={month:'short',day:'numeric'}) => new Intl.DateTimeFormat('en-GB',{...options,timeZone:client.state?.timezone || 'Europe/Berlin'}).format(new Date(value.length===10 ? value+'T12:00:00Z' : value));
  client.el = (tag, cls, text) => {const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  let toastTimer;
  client.toast = (message, undo) => {
    const box=document.querySelector('#toast'); if (!box) return;
    const label=document.querySelector('#toast-text');
    if(label) label.textContent=message; else box.textContent=message;
    const button=document.querySelector('#toast-undo');
    if(button){button.hidden=!undo;button.onclick=async()=>{try{await undo();box.hidden=true;}catch(e){client.toast(e.message);}};}
    box.hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>box.hidden=true,undo?10000:6500);
  };
  client.refresh = async () => {const s=await client.get();if(client.onChange)client.onChange(s);return s;};
  window.addEventListener('online',()=>client.refresh().then(()=>client.flush()).then(()=>client.refresh()).catch(()=>{}));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)client.refresh().then(()=>client.flush()).catch(()=>{});});
})();
