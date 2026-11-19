const assert=require('node:assert/strict'),R=require('../cloud-phone/rhythm.js'),C=require('../cloud-phone/rhythm-calm.js');
const now=Date.parse('2026-11-19T12:00Z'),rows=[],events=[];
for(let d=5;d<=18;d++){for(let m=0;m<1440;m+=5)rows.push({recorded_at:new Date(Date.parse(`2026-11-${String(d).padStart(2,'0')}T00:00Z`)+m*60000).toISOString(),value_mg_dl:m>=660&&m<840?216:126});if(d>=12)events.push({kind:'stress',occurred_at:`2026-11-${d}T11:00Z`});}
const source=R.summarize(rows,events,now),seven=C.period(source,7,R),three=C.period(source,3,R);
assert.equal(three.first,'2026-11-16');assert.equal(new Set(three.current.map(p=>p.date)).size,3);assert.equal(seven.coveredDates,7);assert.equal(three.profile.length,48);assert.equal(three.profile[25].mean,12);
const tag=C.tags(seven,events,'stress',R,now);assert.equal(tag.windows.length,7);assert.equal(tag.label,'Recurring highs');assert.equal(tag.high,1);assert.equal(tag.range,0);assert.equal(tag.profile.length,24);
assert.equal(C.tags(three,events.slice(0,2),'stress',R,now),null);
assert.equal(C.tags(seven,[events[0],events[0],events[0]],'stress',R,now),null);
const blank=C.period(R.summarize([],[],now),3,R);assert.equal(blank.rangeFraction,null);assert.ok(blank.profile.every(p=>p.mean===null));
const normalRows=rows.map(r=>({...r,value_mg_dl:126})),normal=C.period(R.summarize(normalRows,events,now),7,R);assert.equal(C.tags(normal,events,'stress',R,now).label,'Mostly in range');
assert.ok(C.observations(seven,events,R,now).some(p=>p.type==='clock'));assert.ok(C.observations(seven,events,R,now).some(p=>p.type==='tag'));
console.log('PASS: real 3/7-day means and preceding periods, distinct-day tag coverage, overlapping-tap exclusion, relative means, high/in-range outcomes, empty data and clock/tag separation.');
