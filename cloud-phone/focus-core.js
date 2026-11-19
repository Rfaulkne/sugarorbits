/* Shared, deterministic focus rules. No AI or treatment decisions. */
((root)=>{
  const DAY=86400000;
  function evaluate(kind,before,after,elapsed){
    if(elapsed<7*DAY)return {code:'observing',label:'Still observing'};
    if(!before||!after||before.eligible<5||after.eligible<5)return {code:'insufficient',label:'More covered windows needed'};
    if(['activity','stress'].includes(kind)&&(before.distinctDays<3||after.distinctDays<3||!Number.isInteger(before.distinctDays)||!Number.isInteger(after.distinctDays)))return {code:'insufficient',label:'More distinct tagged days needed'};
    const target=kind==='low'?'low':kind==='high'?'high':'range';
    const improved=target==='range'?after.range-before.range>=.1:before[target]-after[target]>=.05&&after[target]<=before[target]*.5;
    const tradeoff=after.low>before.low+.01||after.high>before.high+.05;
    if(improved&&!tradeoff)return {code:'improved',label:'A clearer improvement in the recorded window'};
    if(tradeoff)return {code:'mixed',label:'A mixed picture—review highs and lows together'};
    if(['activity','stress'].includes(kind)&&before.range>=.7&&after.range>=before.range-.03)return {code:'maintained',label:'In-range coverage broadly maintained'};
    return {code:'similar',label:'No clear improvement in the recorded window yet'};
  }
  function context(samples,events,start,end,from,to,R){
    const out={activity:0,stress:0,other:0};
    for(const e of events){const t=Date.parse(e.occurred_at);if(t<from||t>=to||!Number.isFinite(t)||!(e.kind in out))continue;
      const m=R.local(t).minute;if(m>=start&&m<end)out[e.kind]++;}
    return out;
  }
  function measures(plan,rows,events,R,now=Date.now()){
    const samples=R.samples(rows,now),start=plan.started,end=Math.min(now,start+7*DAY);
    const tagged=['activity','stress'].includes(plan.kind);
    // Server-created aggregate baseline survives pruning of the newest-20 raw tags.
    const before=tagged?(plan.baseline||R.tagMetrics(samples,events,plan.kind,start-7*DAY,start)):R.metrics(samples,plan.start,plan.start+180,start-7*DAY,start);
    const after=tagged?R.tagMetrics(samples,events,plan.kind,start,end):R.metrics(samples,plan.start,plan.start+180,start,end);
    return {before,after,outcome:evaluate(plan.kind,before,after,now-start),tags:context(samples,events,tagged?0:plan.start,tagged?1440:plan.start+180,start,end,R),latest:samples.at(-1)?.t||null};
  }
  function due(plan,now,R){
    const r=plan.reminder;if(!r?.enabled||!['active','maintaining'].includes(plan.status)||now>=plan.started+28*DAY||now<plan.started)return null;
    const {date,minute}=R.local(now),at=((['activity','stress'].includes(plan.kind)?r.minute:plan.start)-(r.lead||0)+1440)%1440;
    const quiet=r.quiet_start===r.quiet_end?false:r.quiet_start<r.quiet_end?minute>=r.quiet_start&&minute<r.quiet_end:minute>=r.quiet_start||minute<r.quiet_end;
    if(quiet||minute<at||minute>=at+15)return null;
    const elapsed=Math.floor((now-plan.started)/DAY),type=plan.status==='maintaining'?'keep':elapsed>=7?'review':'checkin';
    if(type==='checkin'&&plan.checkins?.[date])return null;
    if(type==='keep'&&r.frequency===7&&new Date(date+'T12:00Z').getUTCDay()!==new Date(R.local(Date.parse(plan.maintained_at)).date+'T12:00Z').getUTCDay())return null;
    return {date,key:type==='review'?'review':date,type};
  }
  const api={evaluate,context,measures,due};if(typeof module!=='undefined')module.exports=api;root.OrbitFocusCore=api;
})(typeof window!=='undefined'?window:globalThis);
