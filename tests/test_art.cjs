const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const palette = require('../static/orbit-palette.js');
const source = fs.readFileSync(require.resolve('../static/app.js'), 'utf8');
const styles = fs.readFileSync(require.resolve('../static/styles.css'), 'utf8');
function extract(start, end) { return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))); }
const context = {
  SugarOrbitPalette: palette, TARGET_MMOL: 6.4,
  svgElement(tag, attrs={}) { return {tag,attrs,children:[],style:{setProperty(){}},appendChild(x){this.children.push(x);}}; }
};
vm.createContext(context);
vm.runInContext(extract('  function midpoint(', '  function closedSmoothPath(') +
  extract('  function chunksFor(', '  function zone(') +
  extract('  function shapedRadiusForValue(', '  function interpolatePoints(') +
  extract('  function artRing(', '  let revealTimer'), context);
const points = [{minute:0,value:3},{minute:5,value:6},{minute:10,value:12},{minute:80,value:5},{minute:85,value:7}];
const ring=context.artRing(points,0,360,363,200,10);
const paths=ring.children.find(n=>n.attrs.mask).children.filter(n=>n.tag==='path');
const mask=ring.children[0].children.find(n=>n.tag==='mask');
assert.equal(mask.children.length,2,'Each continuous data chunk gets one smooth silhouette');
assert.equal(paths.length,3,'A missing-data gap must not get a connecting segment');
const chunks=context.chunksFor(points);
let offset=0;
for (const chunk of chunks) {
 const shaped=context.shapedPoints(chunk,360,363,200,10);
 const segments=paths.slice(offset,offset+chunk.length-1);
 const combined=segments[0].attrs.d + segments.slice(1).map(p=>p.attrs.d.replace(/^M[^ ]+/, '')).join('');
 assert.equal(combined,context.smoothPath(shaped),'Art must preserve the detail curve geometry');
 offset+=chunk.length-1;
}
assert.notEqual(palette.color(3),palette.color(13));
assert.equal(palette.color(6.4),'rgb(207,199,225)');
assert.equal(context.artRing([],1,360,363,200,10).children.find(n=>n.attrs.mask).children.length,0);
assert.ok(Math.abs(context.minuteFromCartesian(0,-1,0,0)-0)<0.001,'Top is midnight');
assert.ok(Math.abs(context.minuteFromCartesian(1,0,0,0)-360)<0.001,'Right is 06:00');
assert.ok(Math.abs(context.minuteFromCartesian(0,1,0,0)-720)<0.001,'Bottom is noon');
assert.ok(Math.abs(context.minuteFromCartesian(-1,0,0,0)-1080)<0.001,'Left is 18:00');
const timed=[{minute:5,value:5.8},{minute:720,value:8.2}];
assert.equal(context.nearestTimedPoint(timed,1438),timed[0],'Probe wraps cleanly around midnight');
assert.equal(context.nearestTimedPoint(timed,680),null,'Probe does not invent a reading across a gap');
assert.match(source,/TIME IN RANGE · \$\{Math\.round\(dayTimeInRange\)\}%/,'Probe keeps daily time in range visible');
assert.match(source,/moved > 14/,'Shutdown hold cancels on finger movement');
assert.match(source,/\}, 3000\);/,'Shutdown title requires a three-second hold');
assert.match(styles,/@keyframes orbital-tide/,'Art uses the orbital tide motion');
assert.match(styles,/\.trend-range-glow/,'Trend range markers include an orbiting glow');
assert.doesNotMatch(styles,/@keyframes orbit-breathe/,'Whole-wheel breathing is removed');
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
