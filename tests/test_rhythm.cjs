const assert=require('node:assert/strict'),R=require('../cloud-phone/rhythm.js');
const now=Date.parse('2026-11-19T12:00:00Z');
const make=(t,v)=>({recorded_at:new Date(t).toISOString(),value_mg_dl:v});
assert.equal(R.expected('2026-10-25',0,1440),300);assert.equal(R.expected('2026-03-29',0,1440),276);assert.equal(R.expected('2026-11-18',0,1440),288);
const rows=[];for(let d=1;d<=14;d++){for(let n=0;n<288;n++)rows.push(make(now-d*864e5+n*300000,126));}
const s=R.summarize(rows,[],now);assert.equal(s.profile.length,48);assert.equal(s.coveredDates,7);assert.equal(s.rangeFraction,1);assert.ok(s.profile.some(p=>p.mean===7));
assert.equal(R.samples([make(now-300000,126),make(now-300000,180),make(now+10000,126)],now).length,1);
assert.equal(R.samples([make(now-300000,0)],now).length,0);
const start=Date.parse('2026-11-17T23:00:00Z'),twoDays=[];
for(let i=0;i<6;i++)twoDays.push(make(start+i*300000,126));for(let i=0;i<5;i++)twoDays.push(make(start-864e5+i*300000,252));
assert.equal(R.summarize(twoDays,[],now).profile[0].mean,10.5); // equal day weights, not 6:5 reading weights
const samples=R.samples(Array.from({length:36},(_,i)=>make(start+12*3600e3+i*300000,216)),now);
const m=R.metrics(samples,720,900,-Infinity,now);assert.equal(m.eligible,1);assert.equal(m.affectedHigh,1);assert.equal(m.high,1);
assert.equal(R.metrics(samples,720,900,start+12.5*3600e3,now).eligible,0); // focus began mid-window
assert.equal(R.metrics(samples,720,900,-Infinity,start+13*3600e3).eligible,0); // incomplete window
assert.equal(R.metrics(samples.filter((_,i)=>i%2===0),720,900,-Infinity,now).eligible,0);
const tagged=R.samples(Array.from({length:24},(_,i)=>make(start+12*3600e3+i*300000,126)),now),tags=[{kind:'activity',at:new Date(start+12*3600e3).toISOString()},{kind:'activity',at:new Date(start+12.5*3600e3).toISOString()}];
assert.equal(R.activityMetrics(tagged,tags,start,now).eligible,1);assert.equal(R.activityMetrics(tagged,tags,start,now).range,1);
console.log('PASS: DST 23/25h coverage, equal-day means, deduplication, invalid/future samples, full-window/70% gates, affected-day episodes, activity overlap.');
