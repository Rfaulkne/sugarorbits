const assert=require('node:assert/strict'),F=require('../cloud-phone/focus-core.js'),R=require('../cloud-phone/rhythm.js');
const DAY=864e5,before={eligible:7,high:.3,low:.01,range:.69},better={eligible:6,high:.1,low:.01,range:.89};
assert.equal(F.evaluate('high',before,better,8*DAY).code,'improved');
assert.equal(F.evaluate('high',before,{...better,low:.06},8*DAY).code,'mixed');
assert.equal(F.evaluate('high',before,{...better,eligible:4},8*DAY).code,'insufficient');
assert.equal(F.evaluate('high',before,better,6*DAY).code,'observing');
const now=Date.parse('2026-11-19T10:45Z'),plan={kind:'high',start:720,started:now-2*DAY,status:'active',checkins:{},reminder:{enabled:true,lead:15,minute:1080,quiet_start:1320,quiet_end:480,frequency:7}};
assert.equal(F.due(plan,now,R).type,'checkin');assert.equal(F.due(plan,now+16*60000,R),null);
plan.checkins[R.local(now).date]={status:'tried'};assert.equal(F.due(plan,now,R),null);plan.checkins={};
plan.started=now-8*DAY;assert.equal(F.due(plan,now,R).key,'review');
plan.reminder.quiet_start=660;plan.reminder.quiet_end=780;assert.equal(F.due(plan,now,R),null);
plan.reminder.quiet_start=1320;plan.reminder.quiet_end=480;plan.status='maintaining';plan.maintained_at=new Date(now-7*DAY).toISOString();assert.equal(F.due(plan,now,R).type,'keep');
assert.equal(F.due(plan,now+DAY,R),null);plan.started=now-29*DAY;assert.equal(F.due(plan,now,R),null);
// Reminder clocks follow Berlin local time across daylight saving.
plan.status='active';plan.started=Date.parse('2026-03-27T10:45Z');plan.reminder.lead=15;assert.equal(F.due(plan,Date.parse('2026-03-29T09:45Z'),R).type,'checkin');
assert.equal(F.context([], [{kind:'stress',occurred_at:'2026-11-19T11:00Z'},{kind:'other',occurred_at:'bad'}],720,900,now-864e5,now+864e5,R).stress,1);
console.log('PASS: focus coverage/improvement/tradeoffs, tag context, quiet hours, window timing, DST, check-in suppression, weekly maintenance, expiry.');
