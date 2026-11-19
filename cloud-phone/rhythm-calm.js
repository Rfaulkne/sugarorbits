/* Calm Rhythm: actual clock averages and separately labelled post-tag observations. */
((root)=>{
 const pct=v=>Number.isFinite(v)?Math.round(v*100)+'%':'—',clock=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
 const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
 function profile(samples,R){return Array.from({length:48},(_,i)=>{const days=new Map();for(const p of samples)if(Math.floor(p.minute/30)===i){if(!days.has(p.date))days.set(p.date,[]);days.get(p.date).push(p.v);}
  const covered=[...days].filter(([d,a])=>a.length>=Math.ceil(R.expected(d,i*30,i*30+30)*.7)).map(([,a])=>a);
  return {minute:i*30+15,mean:mean(covered.map(mean)),highFraction:0,lowFraction:0,days:covered.length};});}
 function period(state,n,R){const first=R.shift(state.today,-n),prior=R.shift(state.today,-2*n),current=state.all.filter(p=>p.date>=first&&p.date<state.today),previous=state.all.filter(p=>p.date>=prior&&p.date<first);
  return {...state,current,previous,profile:profile(current,R),previousProfile:profile(previous,R),events:[],rangeFraction:current.length?current.filter(p=>p.v>=3.9&&p.v<=10).length/current.length:null,coveredDates:new Set(current.map(p=>p.date)).size,first};}
 function tags(state,events,kind,R,now=Date.now()){
  let last=-Infinity;const windows=[];
  for(const t of events.filter(e=>e.kind===kind).map(e=>Date.parse(e.occurred_at)).filter(Number.isFinite).sort((a,b)=>a-b)){
   const d=R.local(t).date;if(d<state.first||d>=state.today||t<last||t+7200000>now)continue;
   const bins=new Map();for(const p of state.all)if(p.t>=t&&p.t<t+7200000)bins.set(Math.floor((p.t-t)/300000),p);
   if(bins.size<17)continue;last=t+7200000;const points=[...bins.values()].sort((a,b)=>a.t-b.t),values=points.map(p=>p.v);
   const episode=pred=>points.some((p,i)=>i>=2&&pred(p.v)&&pred(points[i-1].v)&&pred(points[i-2].v)&&p.t-points[i-1].t<=360000&&points[i-1].t-points[i-2].t<=360000);
   windows.push({t,date:d,points,high:values.filter(v=>v>10).length/values.length,low:values.filter(v=>v<3.9).length/values.length,range:values.filter(v=>v>=3.9&&v<=10).length/values.length,above:episode(v=>v>10),below:episode(v=>v<3.9)});
  }
  if(windows.length<3||new Set(windows.map(w=>w.date)).size<3)return null;
  const high=mean(windows.map(w=>w.high)),low=mean(windows.map(w=>w.low)),range=mean(windows.map(w=>w.range));
  const above=windows.filter(w=>w.above).length,below=windows.filter(w=>w.below).length;
  const label=above>=Math.ceil(windows.length/2)&&below>=Math.ceil(windows.length/2)?'Mixed highs & lows':above>=Math.ceil(windows.length/2)?'Recurring highs':below>=Math.ceil(windows.length/2)?'Recurring lows':range>=.7?'Mostly in range':'Mixed readings';
  const curve=Array.from({length:24},(_,i)=>{const values=windows.map(w=>w.points.find(p=>Math.floor((p.t-w.t)/300000)===i)?.v).filter(Number.isFinite);return {minute:(i+.5)*60,mean:values.length>=Math.ceil(windows.length*.7)?mean(values):null,highFraction:0,lowFraction:0};});
  return {id:'tag-'+kind,type:'tag',kind,label,windows,high,low,range,profile:curve};
 }
 function observations(state,events,R,now=Date.now()){
  const out=[];for(let start=0;start<1440;start+=180){const m=R.metrics(state.current,start,start+180);if(m.eligible<3)continue;for(const kind of ['high','low']){const count=kind==='high'?m.affectedHigh:m.affectedLow;if(count>=3&&count/m.eligible>=.5)out.push({id:kind+'-'+start,type:'clock',kind,start,end:start+180,count,metrics:m});}}
  for(const kind of ['activity','stress']){const result=tags(state,events,kind,R,now);if(result)out.push(result);}return out;
 }
 class Lenses{
  constructor({getFocus,onCoach}){this.$=id=>document.getElementById(id);this.getFocus=getFocus;this.onCoach=onCoach;this.n=7;this.selected=null;this.orbit=null;
   for(const n of [3,7])this.$('calm-'+n).onclick=()=>{this.n=n;this.selected=null;this.update(this.source,this.events);};
   this.$('calm-reset').onclick=()=>{this.selected=null;this.render();};this.$('calm-coach').onclick=()=>{this.onCoach(this.selected);};
   root.addEventListener?.('resize',()=>this.draw());
  }
  setMode(){this.selected=null;this.render();}
  update(source,events=[]){this.source=source;this.events=events;if(!source){this.state=null;this.selected=null;this.items=[];this.render();return;}
   this.state=period(source,this.n,root.OrbitRhythm);this.items=observations(this.state,events,root.OrbitRhythm);this.selected=this.items.find(p=>p.id===this.selected?.id)||null;this.render();
  }
  render(){const $=this.$,s=this.state,p=this.selected;
   for(const n of [3,7])$('calm-'+n).setAttribute('aria-pressed',String(n===this.n));
   $('lens-title').textContent='Your rhythm.';$('rhythm-period').textContent=s?s.first+' – '+root.OrbitRhythm.shift(s.today,-1):'';
   $('rhythm-range').textContent=pct(p?.type==='tag'?p.range:s?.rangeFraction);$('lens-centre-label').textContent='in range';$('lens-centre-note').textContent=p?.type==='tag'?'2h after '+p.kind:this.n+'-day average';
   $('lens-summary').textContent=p?.type==='tag'?'Following '+p.kind+' · not because of it':p?.type==='clock'?clock(p.start)+'–'+clock(p.end)+' highlighted':'One average orbit. Tap a pattern to look closer.';
   $('rhythm-coverage').textContent=s?s.coveredDates+' / '+this.n+' days recorded · gaps stay open.':'Waiting for recorded days.';
   $('calm-selection').hidden=!p;$('calm-reset').hidden=!p;$('calm-items').replaceChildren();
   for(const item of this.items||[]){const b=document.createElement('button');b.className='calm-pattern';b.setAttribute('aria-pressed',String(item.id===p?.id));const title=document.createElement('strong'),detail=document.createElement('span');
    title.textContent=item.type==='tag'?'After '+item.kind:clock(item.start)+'–'+clock(item.end);
    detail.textContent=item.type==='tag'?item.label+' · '+item.windows.length+' taps':(item.kind==='high'?'Highs':'Lows')+' · '+item.count+'/'+item.metrics.eligible+' days';b.append(title,detail);b.onclick=()=>{this.selected=item;this.render();};$('calm-items').append(b);}
   $('calm-empty').hidden=!!this.items?.length;$('calm-empty').textContent='Still building a picture. No recurring pattern with enough coverage yet.';
   if(!p)for(const id of ['calm-observation','calm-numbers','calm-method'])$(id).textContent='';
   if(p){$('calm-observation').textContent=p.type==='tag'?p.label+' in the two hours after '+p.windows.length+' '+p.kind+' taps.':(p.kind==='high'?'Highs':'Lows')+' in this window on '+p.count+' of '+p.metrics.eligible+' covered days.';
    $('calm-numbers').textContent=p.type==='tag'?pct(p.high)+' above · '+pct(p.range)+' in range · '+pct(p.low)+' below':'Does this time feel familiar?';
    $('calm-method').textContent=p.type==='tag'?'Calculated from non-overlapping two-hour windows on at least three distinct days, each at least 70% recorded. Equal weight per tap; individual outcomes may differ. Only the newest 20 saved taps are available. The orbit is aligned to time since the tap: top=start, right=30min, bottom=60min, left=90min. It is not a daily clock or proof of cause. This tag observation is calculated, not AI-reviewed.':'Calculated recurrence: at least three affected days and at least half of covered days. Each day needs 70% coverage; an episode needs three consecutive five-minute samples. The orbit remains the full daily average, with this window highlighted. The AI chooser in Coach currently reviews seven completed days, regardless of this display switch.';
   }
   this.draw();
  }
  draw(){const canvas=this.$('rhythm-canvas');if(!canvas.getBoundingClientRect||!root.OrbitCanvas)return;if(!this.orbit)this.orbit=new root.OrbitCanvas(canvas,{mini:true});
   if(!this.state){this.orbit.draw(null);return;}const p=this.selected;let state={...this.state};
   state.hideClock=true;
   if(p?.type==='tag'){state.profile=p.profile;state.previousProfile=[];state.clockMinute=0;state.rangeFraction=p.range;}
   this.orbit.draw(state);if(p?.type==='clock')this.orbit.sector(p.start,p.end,'rgba(181,162,213,.09)',342);
   canvas.setAttribute('aria-label',p?.type==='tag'?'Average glucose during the two hours after '+p.kind+' taps. Top is the tap, clockwise one full orbit is two hours.':this.n+' completed days: average glucose by time of day. Purple guides are 3.9 and 10 mmol/L.');
  }
 }
 const api={period,tags,observations,Lenses};if(typeof module!=='undefined')module.exports=api;root.OrbitLenses=api;
})(typeof window!=='undefined'?window:globalThis);
