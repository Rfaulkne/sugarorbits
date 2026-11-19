const assert=require('node:assert/strict'),R=require('../cloud-phone/rhythm.js'),F=require('../cloud-phone/focus-core.js');
const now=Date.parse('2026-11-19T12:00Z'),start=now-8*864e5,rows=[],events=[];
for(let d=1;d<=14;d++){const t=now-d*864e5-3*3600e3;events.push({kind:'stress',occurred_at:new Date(t).toISOString()});for(let m=0;m<120;m+=5)rows.push({recorded_at:new Date(t+m*60000).toISOString(),value_mg_dl:d>8?216:126});}
const samples=R.samples(rows,now),before=R.tagMetrics(samples,events,'stress',start-7*864e5,start);assert.ok(before.eligible>=5);assert.ok(before.distinctDays>=3);
const plan={kind:'stress',start:0,started:start,baseline:before},facts=F.measures(plan,rows,events.filter(e=>Date.parse(e.occurred_at)>=start),R,now);assert.deepEqual(facts.before,before);assert.ok(facts.after.eligible>=5);assert.equal(facts.outcome.code,'improved');
assert.equal(F.evaluate('stress',{eligible:5,distinctDays:3,range:.95,high:.05,low:0},{eligible:5,distinctDays:3,range:.95,high:.05,low:0},8*864e5).code,'maintained');
assert.equal(F.evaluate('stress',before,{...facts.after,distinctDays:1},8*864e5).code,'insufficient');
const duplicate=R.tagMetrics(samples,[events[0],events[0],events[0]],'stress',now-7*864e5,now);assert.equal(duplicate.eligible,1);
const m=R.local(now).minute;assert.equal(F.due({...plan,status:'active',reminder:{enabled:true,minute:m,lead:0,quiet_start:0,quiet_end:0}},now,R).type,'review');
console.log('PASS: stress/activity metric support, distinct-day gate, duplicate tags, frozen aggregate baseline after pruning, progress/maintenance and chosen-clock reminders.');
