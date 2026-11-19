const assert=require('node:assert/strict'),{trace}=require('../cloud-phone/after-moment.js');
const start=Date.parse('2026-11-18T10:02:00Z');
const row=(minutes,value_mg_dl)=>({recorded_at:new Date(start+minutes*60000).toISOString(),value_mg_dl});
const rows=[row(-1,126),row(3,126),row(8,54),row(8,72),row(23,216),row(63,126),row(190,126),row(30,999),{recorded_at:'bad',value_mg_dl:126}];
let data=trace(rows,start,1,start+4*3600000);
assert.equal(data.points.length,3);assert.equal(data.points[1].v,4);assert.equal(data.segments.length,2);assert.equal(data.pending,false);
assert.equal(trace(rows,start,3,start+3600000).points.length,3);
assert.equal(trace(rows,start,3,start+3600000).pending,true);
assert.equal(trace(rows,start,6,start+7*3600000).points.length,5);
assert.equal(trace([],start,1,start).segments.length,0);
// Relative durations remain elapsed hours even across daylight-saving changes.
assert.equal(trace([],Date.parse('2026-10-25T00:30Z'),3).end-Date.parse('2026-10-25T00:30Z'),10800000);
console.log('After-moment tests passed: exact timestamps, limits, deduplication, missing gaps, pending windows, DST.');
