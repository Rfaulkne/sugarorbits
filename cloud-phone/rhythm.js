/* Deterministic summaries. No AI calls, cause inference or treatment advice. */
(() => {
  const timezone='Europe/Berlin', DAY=864e5;
  const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const local=stamp=>{
    const p=Object.fromEntries(formatter.formatToParts(new Date(stamp)).map(x=>[x.type,x.value]));
    return {date:`${p.year}-${p.month}-${p.day}`,minute:+p.hour*60 + +p.minute};
  };
  const shift=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);
  function samples(rows,now=Date.now()){
    const unique=new Map();
    for(const r of rows){const t=Date.parse(r.recorded_at),v=r.value_mg_dl;if(!Number.isFinite(t)||t>now||!Number.isFinite(v)||v<20||v>600)continue;
      unique.set(Math.floor(t/300000),{t,v:v/18,...local(t)});}
    return [...unique.values()].sort((a,b)=>a.t-b.t);
  }
  const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  function summarize(rows,events=[],now=Date.now()){
    const today=local(now).date,start=shift(today,-7),previousStart=shift(today,-14),all=samples(rows,now);
    const current=all.filter(r=>r.date>=start&&r.date<today),previous=all.filter(r=>r.date>=previousStart&&r.date<start);
    function profile(group){return Array.from({length:48},(_,i)=>{
      const days=new Map();for(const r of group)if(Math.floor(r.minute/30)===i){if(!days.has(r.date))days.set(r.date,[]);days.get(r.date).push(r.v);}
      // >=5 of the usual 6 five-minute samples per local half-hour. Equal day weights.
      // The repeated DST half-hour needs >=9 of its 12 actual slots.
      const eligible=[...days].filter(([d,a])=>a.length>=Math.ceil(expected(d,i*30,i*30+30)*.7)).map(([,a])=>a);
      return {minute:i*30+15,mean:mean(eligible.map(a=>mean(a))),highFraction:mean(eligible.map(a=>a.filter(v=>v>10).length/a.length))||0,lowFraction:mean(eligible.map(a=>a.filter(v=>v<3.9).length/a.length))||0,days:eligible.length};
    });}
    return {today,timezone,clockMinute:local(now).minute,profile:profile(current),previousProfile:profile(previous),current,previous,all,
      events:events.filter(e=>e&&Date.parse(e.occurred_at)>=Date.parse(start+'T00:00:00Z')-DAY&&Date.parse(e.occurred_at)<=now).map(e=>({id:e.id,kind:e.kind,at:e.occurred_at})),
      days:[],coveredDates:new Set(current.map(r=>r.date)).size,
      rangeFraction:current.length?current.filter(r=>r.v>=3.9&&r.v<=10).length/current.length:null};
  }
  const expectedCache=new Map();
  function daySlots(date){
    if(!expectedCache.has(date)){const noon=Date.parse(date+'T12:00:00Z'),slots=[];
      for(let t=noon-26*3600e3;t<noon+26*3600e3;t+=300000){const p=local(t);if(p.date===date)slots.push({minute:p.minute,t});}
      expectedCache.set(date,slots);}
    return expectedCache.get(date);
  }
  function expected(date,start,end){return daySlots(date).filter(s=>s.minute>=start&&s.minute<end).length;}
  function metrics(group,start,end,after=-Infinity,now=Date.now()){
    const days=new Map();for(const r of group)if(r.minute>=start&&r.minute<end){if(!days.has(r.date))days.set(r.date,[]);days.get(r.date).push(r);}
    let eligible=0,affectedHigh=0,affectedLow=0,high=0,low=0,range=0;
    for(const [date,a] of days){
      // Exclude a window containing any pre-experiment samples.
      const slots=daySlots(date).filter(s=>s.minute>=start&&s.minute<end);
      if(!slots.length||slots[0].t<after||slots[slots.length-1].t+300000>now||a.length<Math.ceil(slots.length*.7))continue;
      eligible++;const values=a.map(r=>r.v);const h=values.filter(v=>v>10).length/values.length,l=values.filter(v=>v<3.9).length/values.length;
      high+=h;low+=l;range+=1-h-l;
      const episode=predicate=>a.some((r,i)=>i>=2&&predicate(r.v)&&predicate(a[i-1].v)&&predicate(a[i-2].v)&&r.t-a[i-1].t<=6*60000&&a[i-1].t-a[i-2].t<=6*60000);
      affectedHigh+=+episode(v=>v>10);affectedLow+=+episode(v=>v<3.9);
    }
    return {eligible,high:eligible?high/eligible:null,low:eligible?low/eligible:null,range:eligible?range/eligible:null,affectedHigh,affectedLow};
  }
  function activityMetrics(group,events,from,to){
    const tags=events.filter(e=>e.kind==='activity').map(e=>Date.parse(e.at||e.occurred_at)).filter(t=>t>=from&&t+2*3600e3<=to).sort((a,b)=>a-b);
    let eligible=0,range=0,low=0,high=0,last=-Infinity;
    for(const t of tags){if(t<last)continue;last=t+2*3600e3;const values=group.filter(r=>r.t>=t&&r.t<last);if(values.length<17)continue;
      eligible++;range+=values.filter(r=>r.v>=3.9&&r.v<=10).length/values.length;high+=values.filter(r=>r.v>10).length/values.length;low+=values.filter(r=>r.v<3.9).length/values.length;}
    return {eligible,range:eligible?range/eligible:null,high:eligible?high/eligible:null,low:eligible?low/eligible:null};
  }
  const api={local,shift,samples,summarize,metrics,activityMetrics,expected};
  if(typeof module!=='undefined')module.exports=api;else window.OrbitRhythm=api;
})();
