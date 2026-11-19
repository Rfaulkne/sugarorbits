const assert=require('node:assert/strict'),R=require('../cloud-phone/rhythm.js'),{build}=require('../cloud-phone/rhythm-lenses.js');
const now=Date.parse('2026-11-19T12:00Z'),rows=[];
for(let d=12;d<=18;d++)for(let m=0;m<1440;m+=5){if(d===15)continue;const t=Date.parse(`2026-11-${d}T00:00Z`)+m*60000;rows.push({recorded_at:new Date(t).toISOString(),value_mg_dl:d<=14&&m>=660&&m<840?216:126});}
const state=R.summarize(rows,[],now),events=[{kind:'stress',occurred_at:'2026-11-13T12:00Z'},{kind:'activity',occurred_at:'2026-11-13T09:00Z'},{kind:'stress',occurred_at:'bad'}];
const data=build(state,events,R),p=data.patterns.find(p=>p.id==='high-720');
assert.equal(data.days.length,7);assert.equal(data.days[0].date,'2026-11-12');assert.equal(data.days.at(-1).date,'2026-11-18');assert.equal(p.affected,3);assert.equal(p.metrics.eligible,6);assert.equal(p.tags.stress,1);assert.equal(p.tags.activity,0);
assert.ok(!data.patterns.some(p=>p.kind==='low'));assert.ok(data.days.every(d=>d.tir===null||d.tir>=0&&d.tir<=1));
const blank=build(R.summarize([],[],now),[],R);assert.equal(blank.patterns.length,0);assert.ok(blank.days.every(d=>d.tir===null&&d.points.length===0));
const short=build(R.summarize(rows.filter(r=>r.recorded_at>='2026-11-17'),[],now),[],R);assert.equal(short.patterns.length,0);
console.log('PASS: seven dated actual profiles, missing data, recurring-window evidence/coverage, retained tag overlap, no invented patterns.');
