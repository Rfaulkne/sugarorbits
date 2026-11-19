/* One visual, three lenses. Calculations describe associations, never causes. */
((root)=>{
 'use strict';
 const clock=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
 const pct=v=>Number.isFinite(v)?Math.round(v*100)+'%':'—';
 function build(state,events,R){
  const days=Array.from({length:7},(_,i)=>{const date=R.shift(state.today,i-7),samples=state.current.filter(p=>p.date===date);
   return {date,points:samples.map(p=>({minute:p.minute,value:p.v,t:p.t})),tir:samples.length?samples.filter(p=>p.v>=3.9&&p.v<=10).length/samples.length:null,mean:samples.length?samples.reduce((s,p)=>s+p.v,0)/samples.length:null,count:samples.length};});
  const patterns=[];
  for(let start=0;start<1440;start+=180){const metrics=R.metrics(state.current,start,start+180);if(metrics.eligible<3)continue;
   for(const kind of ['high','low']){const affected=kind==='high'?metrics.affectedHigh:metrics.affectedLow;if(affected<3||affected/metrics.eligible<.5)continue;
    const tags={activity:0,stress:0,other:0};for(const e of events){const t=Date.parse(e.occurred_at);if(!Number.isFinite(t)||!Object.hasOwn(tags,e.kind))continue;const p=R.local(t);if(p.date>=days[0].date&&p.date<state.today&&p.minute>=start&&p.minute<start+180)tags[e.kind]++;}
    patterns.push({id:kind+'-'+start,kind,start,end:start+180,affected,metrics,tags});
   }
  }
  patterns.sort((a,b)=>b.affected/b.metrics.eligible-a.affected/a.metrics.eligible||a.start-b.start);
  return {days,patterns};
 }
 class Lenses{
  constructor({getFocus,onStart,onCoach}){
   this.$=id=>document.getElementById(id);this.getFocus=getFocus;this.onStart=onStart;this.onCoach=onCoach;this.mode='week';this.day=null;this.selected=null;this.dismissed=new Set();this.editing=false;
   const $=this.$;this.canvas=$('rhythm-canvas');this.orbit=null;
   for(const mode of ['week','patterns','focus'])$('lens-'+mode).onclick=()=>this.setMode(mode);
   $('lens-day').oninput=()=>{this.day=+$('lens-day').value-1;if(this.day<0)this.day=null;this.draw();this.context();};
   $('lens-all-days').onclick=()=>{this.day=null;$('lens-day').value='0';this.draw();this.context();};
   $('lens-show-all').onclick=()=>{this.dismissed.clear();$('lens-response').textContent='';this.update(this.state,this.events);};
   $('lens-explore').onclick=()=>{this.editing=true;$('lens-response').textContent='';$('lens-experiment').hidden=false;$('lens-intent').focus?.();};
   $('lens-watch').onclick=()=>{$('lens-response').textContent='Just watching. No focus or reminder has been created.';this.editing=false;$('lens-experiment').hidden=true;};
   $('lens-dismiss').onclick=()=>{if(this.selected)this.dismissed.add(this.selected.id);this.selected=null;this.editing=false;this.update(this.state,this.events);$('lens-response').textContent='Hidden for this visit—not removed from your data. Show all brings it back.';};
   $('lens-experiment').onsubmit=e=>{e.preventDefault();const habit=$('lens-intent').value.trim();if(habit&&this.selected)this.onStart(this.selected,habit);};
   $('lens-coach').onclick=()=>this.onCoach();
   const move=e=>{if(!this.state||this.mode!=='week'||!this.orbit)return;const index=this.orbit.pick(e);this.day=index;$('lens-day').value=String(index===null?0:index+1);this.draw();this.context();};
   this.canvas.addEventListener?.('pointermove',e=>{if(e.pointerType==='mouse'||this.dragging)move(e);});
   this.canvas.addEventListener?.('pointerdown',e=>{if(this.mode==='week'){this.dragging=true;move(e);}else{const b=this.canvas.getBoundingClientRect(),x=e.clientX-b.left-b.width/2,y=e.clientY-b.top-b.height/2;if(Math.hypot(x,y)<b.width*.2)return;const m=((Math.atan2(y,x)+Math.PI/2+2*Math.PI)%(2*Math.PI))/(2*Math.PI)*1440;const p=this.visible().find(p=>m>=p.start&&m<p.end);if(p)this.choose(p);}});
   const release=()=>{this.dragging=false;if(this.mode==='week'){this.day=null;$('lens-day').value='0';this.draw();this.context();}};
   for(const name of ['pointerup','pointercancel','pointerleave'])this.canvas.addEventListener?.(name,release);
   root.addEventListener?.('resize',()=>{this.draw();this.drawTrace();});
  }
  visible(){return (this.data?.patterns||[]).filter(p=>!this.dismissed.has(p.id));}
  update(state,events=[]){this.state=state;this.events=events;if(!state){this.data=null;this.selected=null;this.day=null;this.dismissed.clear();this.mode='week';this.editing=false;this.$('lens-intent').value='';this.$('lens-response').textContent='';this.draw();this.context();return;}
   this.data=build(state,events,root.OrbitRhythm);const next=this.visible().find(p=>p.id===this.selected?.id);this.selected=next||null;
   if(this.mode==='patterns'&&!this.selected)this.selected=this.visible()[0]||null;this.draw();this.context();
  }
  setMode(mode){this.mode=mode;this.day=null;this.editing=false;this.$('lens-response').textContent='';if(mode==='patterns'&&!this.selected)this.selected=this.visible()[0]||null;this.draw();this.context();}
  choose(pattern){this.selected=pattern;this.editing=false;this.$('lens-intent').value='';this.$('lens-response').textContent='';this.draw();this.context();}
  draw(){
   const $=this.$;for(const mode of ['week','patterns','focus'])$('lens-'+mode).setAttribute('aria-pressed',String(mode===this.mode));
   if(!this.canvas.getBoundingClientRect||!root.OrbitCanvas)return;
   if(!this.orbit)this.orbit=new root.OrbitCanvas(this.canvas,{mini:false});
   if(!this.state){this.orbit.draw(null);return;}
   const focus=this.getFocus(),state={...this.state,days:this.data.days,mutedDays:this.mode!=='week'};
   this.orbit.selected=this.mode==='week'?this.day:null;
   if(this.mode==='focus'&&focus){state.focus={start:focus.start,end:focus.kind==='activity'?1440:focus.start+180,elapsedDays:Math.floor((Date.now()-focus.started)/864e5)};this.orbit.draw(state,'focus');}
   else{this.orbit.draw(state,'days');if(this.mode!=='week'){const p=this.selected;if(p)this.orbit.sector(p.start,p.end,'rgba(181,162,213,.08)',345);
     for(const candidate of this.visible()){const selected=candidate.id===p?.id;this.orbit.arc(candidate.start+8,candidate.end-8,candidate.kind==='high'?334:314,candidate.kind==='high'?'#f3894b':'#758fff',selected?7:3,selected?.95:.4);}}}
  }
  context(){
   const $=this.$,state=this.state,f=this.getFocus();$('lens-day-controls').hidden=this.mode!=='week';$('lens-options').hidden=this.mode!=='patterns';$('lens-choice').hidden=true;$('lens-focus-card').hidden=true;$('lens-trace-wrap').hidden=true;if(f)this.editing=false;$('lens-experiment').hidden=!this.editing;$('lens-show-all').hidden=this.mode!=='patterns'||!this.dismissed.size;
   $('lens-options').replaceChildren();
   if(!state){$('lens-summary').textContent='Your recorded days will appear here.';$('rhythm-range').textContent='—';$('lens-centre-label').textContent='in range';$('lens-centre-note').textContent='recorded samples';$('lens-title').textContent='One rhythm. Your perspective.';return;}
   const p=this.mode==='patterns'?this.selected:null,day=this.day===null?null:this.data.days[this.day];
   $('lens-title').textContent=this.mode==='week'?'Seven days, side by side.':this.mode==='patterns'?'Notice what repeats.':'Keep your thread in view.';
   $('rhythm-range').textContent=pct(day?day.tir:state.rangeFraction);$('lens-centre-label').textContent=day?day.date:'week · in range';$('lens-centre-note').textContent=day?(day.mean===null?'No readings':day.mean.toFixed(1)+' mmol/L average'):'recorded samples';
   $('lens-summary').textContent=this.mode==='week'?'One orbit per completed day. Touch a ring, or use the day dial below. Release the ring to see the whole week.':this.mode==='patterns'?'Faint rings are your real days. Orange/blue markers identify recurring windows, not a claim that the average crossed the range. Tap a marker or a window below.':'Your chosen window stays highlighted. Review it with the same coach and check-ins—not a separate plan.';
   $('lens-day-label').textContent=day?day.date+' · '+day.count+' readings':'All seven days · oldest inside, newest outside';
   if(this.mode==='patterns'){
    for(const candidate of this.visible()){const b=document.createElement('button');b.className='pattern-chip '+candidate.kind;b.textContent=clock(candidate.start)+'–'+clock(candidate.end)+' · '+(candidate.kind==='high'?'above':'below');b.setAttribute('aria-pressed',String(candidate.id===p?.id));b.onclick=()=>this.choose(candidate);$('lens-options').append(b);}
    if(!this.visible().length){const empty=document.createElement('p');empty.className='hint';empty.textContent=this.dismissed.size?'No visible suggestions. Show all to bring hidden windows back.':'No recurring window meets the minimum yet: at least three affected days and at least half the adequately recorded days. Keep observing; missing data is not a good or bad result.';$('lens-options').append(empty);}
   }
   if(p){$('lens-choice').hidden=false;$('lens-observation').textContent=`${clock(p.start)}–${clock(p.end)} · ${p.kind==='high'?'Above':'Below'} range on ${p.affected} of ${p.metrics.eligible} covered days.`;
    $('lens-context-tags').textContent='Nearby taps in this clock window: '+Object.entries(p.tags).map(([k,n])=>k+' '+n).join(' · ')+'. Only the latest 20 saved taps are available; overlap does not explain the pattern.';
    $('lens-evidence').textContent='Affected means three consecutive five-minute readings outside range. Each counted day needs at least 70% window coverage. The traces below show the readings behind this observation.';
    $('lens-explore').hidden=!!f;$('lens-existing').hidden=!f;
   }
   if(this.mode==='focus'){$('lens-focus-card').hidden=false;$('lens-focus-title').textContent=f?(f.kind==='activity'?'Around tagged activity':clock(f.start)+'–'+clock(f.start+180)):'Nothing chosen yet.';$('lens-focus-copy').textContent=f?f.habit:'Switch to Patterns, explore a window that feels relevant, and choose what you want to try or simply notice.';$('lens-coach').textContent=f?'Open my coach & check-in':'Explore patterns';$('lens-coach').onclick=()=>f?this.onCoach():this.setMode('patterns');
    if(f){$('lens-centre-label').textContent='week · in range';$('lens-centre-note').textContent='focus highlighted';}}
   const window=p||(this.mode==='focus'&&f&&f.kind!=='activity'?{start:f.start,end:f.start+180}:day?{start:0,end:1440}:null);
   this.traceWindow=window;if(window){$('lens-trace-wrap').hidden=false;$('lens-trace-title').textContent=clock(window.start)+'–'+clock(window.end)+' · '+(day?day.date:'each line is a day');this.drawTrace();}
   this.canvas.setAttribute('aria-label',this.mode==='week'?'Seven daily glucose rings. '+(day?day.date+' '+pct(day.tir)+' in range.':'Use the day dial to isolate a date.'):p?$('lens-observation').textContent:'Your focus shown against the weekly average and preceding week.');
  }
  drawTrace(){
   const canvas=this.$('lens-trace'),w=this.traceWindow;if(!w||!this.data||!canvas.getBoundingClientRect)return;
   const width=canvas.getBoundingClientRect().width;if(!width)return;const dpr=Math.min(root.devicePixelRatio||1,2),height=200;canvas.width=width*dpr;canvas.height=height*dpr;
   const c=canvas.getContext('2d');c.scale(dpr,dpr);c.clearRect(0,0,width,height);
   const days=this.day===null?this.data.days:[this.data.days[this.day]],values=days.flatMap(d=>d.points.filter(p=>p.minute>=w.start&&p.minute<w.end).map(p=>p.value));const lo=Math.min(2,...values)-.5,hi=Math.max(12,...values)+.5,left=8,right=width-34,top=12,bottom=169;
   const x=m=>left+(m-w.start)/(w.end-w.start)*(right-left),y=v=>bottom-(v-lo)/(hi-lo)*(bottom-top);
   c.fillStyle='rgba(181,162,213,.12)';c.fillRect(left,y(10),right-left,y(3.9)-y(10));c.font='12px system-ui';c.fillStyle='#bcacd4';c.fillText('10',right+5,y(10)+4);c.fillText('3.9',right+5,y(3.9)+4);
   days.forEach((day,i)=>{c.lineWidth=this.day===null?1.4:2;c.strokeStyle=['#b9c9ac','#c7b8dd','#a8c6c5','#dbceba','#b8bfd8','#c3ceba','#e2e7da'][i];c.globalAlpha=this.day===null?.65:1;c.beginPath();let prev=null;for(const p of day.points){if(p.minute<w.start||p.minute>=w.end)continue;if(prev&&p.t-prev.t<=600000&&p.minute>=prev.minute)c.lineTo(x(p.minute),y(p.value));else c.moveTo(x(p.minute),y(p.value));prev=p;}c.stroke();});c.globalAlpha=1;c.fillStyle='#9fac99';c.textAlign='left';c.fillText(clock(w.start),left,194);c.textAlign='right';c.fillText(clock(w.end),right,194);
   canvas.setAttribute('aria-label','Actual daily readings in '+clock(w.start)+'–'+clock(w.end)+'. '+values.length+' recorded samples. Gaps over ten minutes are not joined.');
  }
 }
 const api={build,Lenses};if(typeof module!=='undefined')module.exports=api;root.OrbitLenses=api;
})(typeof window!=='undefined'?window:globalThis);
