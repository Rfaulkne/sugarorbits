const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const palette = require('../static/orbit-palette.js');
const source = fs.readFileSync(require.resolve('../static/app.js'), 'utf8');
const styles = fs.readFileSync(require.resolve('../static/styles.css'), 'utf8');
function extract(start, end) { return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))); }
const context = {
  SugarOrbitPalette: palette, TARGET_MMOL: 6.4, LOW_MMOL: 3.9, HIGH_MMOL: 10.0,
  svgElement(tag, attrs={}) { return {tag,attrs,children:[],style:{setProperty(){}},appendChild(x){this.children.push(x);}}; }
};
vm.createContext(context);
vm.runInContext(extract('  function midpoint(', '  function closedSmoothPath(') +
  extract('  function chunksFor(', '  function zone(') +
  extract('  function shapedRadiusForValue(', '  function interpolatePoints(') +
  extract('  function glucoseRangePercentages(', '  function previousPeriodTrend(') +
  extract('  function artRing(', '  let revealTimer'), context);
const points = [{minute:0,value:3},{minute:5,value:6},{minute:10,value:12},{minute:80,value:5},{minute:85,value:7}];
const ring=context.artRing(points,0,360,363,200,10);
const chunks=context.chunksFor(points);
const lines=ring.children.filter(n=>n.attrs.class==='art-orbit-line');
const dots=ring.children.filter(n=>n.attrs.class==='art-orbit-dot');
assert.equal(lines.length,2,'Missing data stays split into separate grey paths');
assert.equal(dots.length,1,'Each daily ring gets exactly one orbiting dot');
assert.equal(dots[0].attrs.pathLength,100,'Dot motion uses normalized path length');
chunks.forEach((chunk,index)=>assert.equal(
 lines[index].attrs.d,
 context.smoothPath(context.shapedPoints(chunk,360,363,200,10)),
 'Art must preserve detail curve geometry'
));
assert.equal(dots[0].attrs.d,lines[0].attrs.d,'Dot follows the longest uninterrupted real-data path');
assert.notEqual(palette.color(3),palette.color(13));
assert.equal(palette.color(6.4),'rgb(207,199,225)');
assert.equal(context.artRing([],1,360,363,200,10).children.length,0);
assert.ok(Math.abs(context.minuteFromCartesian(0,-1,0,0)-0)<0.001,'Top is midnight');
assert.ok(Math.abs(context.minuteFromCartesian(1,0,0,0)-360)<0.001,'Right is 06:00');
assert.ok(Math.abs(context.minuteFromCartesian(0,1,0,0)-720)<0.001,'Bottom is noon');
assert.ok(Math.abs(context.minuteFromCartesian(-1,0,0,0)-1080)<0.001,'Left is 18:00');
const timed=[{minute:5,value:5.8},{minute:720,value:8.2}];
assert.equal(context.nearestTimedPoint(timed,1438),timed[0],'Probe wraps cleanly around midnight');
assert.equal(context.nearestTimedPoint(timed,680),null,'Probe does not invent a reading across a gap');
const range=context.glucoseRangePercentages([[{value:3.8},{value:3.9},{value:8},{value:10},{value:10.1}]]);
assert.equal(range.below,20,'Below range uses values strictly below 3.9');
assert.equal(range.inRange,60,'Time in range includes both thresholds');
assert.equal(range.above,20,'Above range uses values strictly above 10.0');
assert.equal(context.timeInRangeForDay([]),null,'No readings produce no time-in-range claim');
assert.match(source,/TIME IN RANGE · \$\{visibleTimeInRange\}/,'All-rings center shows weekly time in range');
assert.match(source,/BELOW 3\.9 · ABOVE 10\.0/,'Trends center labels below and above percentages');
assert.match(source,/TIME IN RANGE · \$\{Math\.round\(dayTimeInRange\)\}%/,'Probe keeps daily time in range visible');
assert.match(source,/moved > 14/,'Shutdown hold cancels on finger movement');
assert.match(source,/\}, 3000\);/,'Shutdown title requires a three-second hold');
assert.match(styles,/@keyframes art-dot-orbit/,'Art uses orbiting dots');
assert.match(styles,/\.art-orbit-line[^}]*rgba\(241, 244, 237, 0\.18\)/s,'Home paths are faint neutral grey');
assert.match(styles,/\.trend-range-glow/,'Trend range markers include an orbiting glow');
assert.doesNotMatch(styles,/@keyframes orbit-breathe/,'Whole-wheel breathing is removed');
assert.doesNotMatch(styles,/@keyframes orbital-tide/,'Ring scaling tide is removed');
assert.doesNotMatch(styles,/@keyframes art-trim-orbit/,'Moving trim animation is removed');
const listeners={};let now=0,changes=0;
Object.assign(context,{
 stage:{addEventListener:(n,f)=>(listeners[n]??=[]).push(f),classList:{add(){},remove(){}}},
 roundDisplayLayout:{matches:true},phoneLayout:{matches:false},introVortex:{hidden:true},
 performance:{now:()=>now},navigator:{},threeFingerGestureActive:false,
 mobileSelectedDay:null,clearCurrentDay(){},currentPeriodOffset:0,showHistoryPeriod(){return true},
 viewMode:'art',applyViewMode(){changes++},revealArt(){},
 orbitProbePointer:null
});
vm.runInContext(extract('  let swipeStart = null;', '  window.addEventListener("keydown"'),context);
function fire(type,id,x,y=200) {now+=100; for(const f of listeners[type]||[]) f({pointerId:id,pointerType:'touch',isPrimary:id===1,clientX:x,clientY:y,preventDefault(){}});}
function swipe(from,to) {fire('pointerdown',1,from);fire('pointerup',1,to);}
swipe(400,300);assert.equal(context.viewMode,'days');
swipe(400,300);assert.equal(context.viewMode,'patterns');
swipe(400,300);assert.equal(context.viewMode,'art','Wrap to art');
swipe(300,400);assert.equal(context.viewMode,'patterns','Either direction can leave art');
swipe(300,400);assert.equal(context.viewMode,'days');
swipe(300,400);assert.equal(context.viewMode,'art');
fire('pointerdown',1,400);fire('pointerdown',2,450);fire('pointerup',2,450);fire('pointerup',1,300);assert.equal(context.viewMode,'art');
fire('pointerdown',1,400);fire('pointercancel',1,400);fire('pointerup',1,300);assert.equal(context.viewMode,'art');
fire('pointerdown',1,400);now+=1000;fire('pointerup',1,350);assert.equal(context.viewMode,'days','Allow a slower short swipe');
fire('pointerdown',1,400);context.orbitProbePointer=1;fire('pointerup',1,300);context.orbitProbePointer=null;
assert.equal(context.viewMode,'days','Dragging a data probe must not switch views');
const mouse={pointerId:99,pointerType:'mouse',isPrimary:true,button:0,clientX:400,clientY:200};
for(const f of listeners.pointerdown) f(mouse);
for(const f of listeners.pointerup) f({...mouse,clientX:300});
assert.equal(context.viewMode,'patterns','Support mouse-emulated touch');
console.log('Art geometry, palette, missing-data gaps and three-view gesture checks passed.');
