(() => {
  'use strict';
  const C=window.OrbitClient,canvas=document.querySelector('#orbit'),view=new OrbitCanvas(canvas);
  const modes=['rhythm','days','focus'];let mode='rhythm',state=null,gesture=null;
  const $=s=>document.querySelector(s);
  const set=(id,text)=>$(id).textContent=text;
  const pct=v=>v===null?'—':Math.round(v*100)+'%';
  function centre(){
    if(!state)return;
    const f=state.focus,s=state.weekStats;
    if(mode==='days'){
      const day=state.days[view.selected];
      if(day){
        set('#centre-kicker',C.date(day.date,{weekday:'long',day:'numeric',month:'short'})+(day.partial?' · today so far':''));
        set('#centre-title',`${day.tir??'—'}% in range`);
        const p=day.points.reduce((best,p)=>Math.abs(p.minute-view.hoverMinute)<Math.abs(best.minute-view.hoverMinute)?p:best,day.points[0]);
        set('#centre-note',p&&Math.abs(p.minute-view.hoverMinute)<=20?`${C.clock(p.minute)} · ${p.value.toFixed(1)} mmol/L`:'No reading near this time');
        set('#centre-detail',`${day.mean?.toFixed(1)??'—'} mmol/L mean · ${Math.round(day.coverage*100)}% coverage`);
      }else{
        const points=state.days.flatMap(d=>d.points),average=points.length?points.reduce((s,p)=>s+p.value,0)/points.length:null;
        const tir=points.length?Math.round(points.filter(p=>p.value>=3.9&&p.value<=10).length/points.length*100):null;
        set('#centre-kicker','SEVEN DAILY ORBITS');set('#centre-title',average===null?'Collecting your days.':`${average.toFixed(1)} mmol/L`);
        set('#centre-note',tir===null?'Your actual data appears as it arrives.':`${tir}% time in range · includes today so far`);set('#centre-detail','touch a ring · move inward or outward to change day');
      }
    }else if(mode==='focus'){
      set('#centre-kicker',f?(f.reviewDue?'YOUR REVIEW IS READY':'ONE SMALL FOCUS'):'ORBIT FOCUS');set('#centre-title',f?f.habit:'Keep a little thread.');
      set('#centre-note',f?`${C.clock(f.start)}–${C.clock(f.end)}\n${f.doneDays} completed check-ins · day ${Math.min(7,f.elapsedDays+1)} of 7`:'Choose one period and a habit\nin your phone companion.');
      set('#centre-detail',f&&f.reviewDue?'open your phone for a gentle reflection':'Phone companion · /phone');
    }else if(view.hoverMinute!==null){
      const i=Math.min(47,Math.floor(view.hoverMinute/30)),b=state.profile[i];
      set('#centre-kicker',`${C.clock(i*30)}–${C.clock(i*30+30)} · WEEKLY RHYTHM`);set('#centre-title',b.mean===null?'Still taking shape.':`${b.mean.toFixed(1)} mmol/L`);
      set('#centre-note',b.mean===null?'At least 3 covered days needed.':`${pct(b.highFraction)} above · ${pct(b.lowFraction)} below`);set('#centre-detail',`${b.validDays} covered days · no inferred cause`);
    }else{
      set('#centre-kicker','YOUR WEEKLY RHYTHM');set('#centre-title',s.mean===null?'Still taking shape.':`${s.mean.toFixed(1)} mmol/L`);
      set('#centre-note',s.mean===null?'The orbit appears after three covered days.':`${pct(s.highFraction)} above · ${pct(s.lowFraction)} below\n${s.validDays} covered days · seven completed days`);
      set('#centre-detail','grey · this week     purple · previous week');
    }
  }
  function draw(){view.draw(state,mode);centre();}
  function switchMode(next){mode=next;view.selected=null;view.hoverMinute=null;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));set('#hint',mode==='days'?'touch a ring to explore · swipe in the centre to switch':'swipe to explore · touch to reveal');draw();}
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>switchMode(b.dataset.mode));
  canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);const p=view.pointer(e);gesture={x:e.clientX,y:e.clientY,swipe:mode!=='days'||p.r<120||p.r>350};if(mode==='days')view.pick(e);else view.hoverMinute=p.minute;draw();};
  canvas.onpointermove=e=>{
    if(e.pointerType==='mouse'||gesture){if(mode==='days')view.pick(e);else {const p=view.pointer(e);view.hoverMinute=p.r>120&&p.r<350?p.minute:null;}draw();}
  };
  const release=e=>{if(gesture&&gesture.swipe&&Math.abs(e.clientX-gesture.x)>65&&Math.abs(e.clientY-gesture.y)<65){const direction=e.clientX<gesture.x?1:-1;switchMode(modes[(modes.indexOf(mode)+direction+3)%3]);}gesture=null;view.selected=null;view.hoverMinute=null;draw();};
  canvas.onpointerup=release;canvas.onpointercancel=()=>{gesture=null;view.selected=null;view.hoverMinute=null;draw();};canvas.onpointerleave=()=>{if(!gesture){view.selected=null;view.hoverMinute=null;draw();}};
  C.onChange=s=>{state=s;$('#demo-label').hidden=!s.demo;const connection=$('#connection');connection.textContent=s.demo?'synthetic data · preview only':s.stale?'cached data · feed delayed':`${C.date(s.weekStart)} – ${C.date(s.weekEnd)} · ${s.timezone}`;connection.classList.toggle('offline',s.stale&&!s.demo);draw();};
  async function refresh(){try{await C.refresh();}catch(e){$('#connection').classList.add('offline');set('#connection','Pi unavailable · showing last view');if(!state){set('#centre-title','A little patience.');set('#centre-note',e.message);}}}
  refresh();setInterval(()=>{if(!document.hidden)refresh();},30000);window.addEventListener('resize',draw);
  // Safe shutdown stays local to the Pi and requires two deliberate holds.
  fetch('/api/status').then(r=>r.json()).then(s=>$('#power').hidden=!s.shutdownEnabled||C.demo).catch(()=>{});
  let holdTimer,shutdownPending=false;
  function hold(button,ms,action){button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);const x=e.clientX,y=e.clientY;button.classList.add('holding');holdTimer=setTimeout(action,ms);button.onpointermove=e=>{if(Math.hypot(e.clientX-x,e.clientY-y)>12)cancel();};};const cancel=()=>{clearTimeout(holdTimer);button.classList.remove('holding');};button.onpointerup=cancel;button.onpointercancel=cancel;button.onlostpointercapture=cancel;}
  hold($('#power'),4000,()=>$('#power-dialog').showModal());
  $('#power-cancel').onclick=()=>{if(!shutdownPending)$('#power-dialog').close();};
  hold($('#power-confirm'),2000,async()=>{if(shutdownPending)return;shutdownPending=true;try{const r=await fetch('/api/poweroff',{method:'POST',headers:{'X-Sugar-Orbits-Action':'poweroff'}});if(!r.ok)throw new Error('Shutdown unavailable. Use the existing SSH shutdown command.');set('#power-confirm','Shutting down…');}catch(e){shutdownPending=false;C.toast(e.message);}});
})();
