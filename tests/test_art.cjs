const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const palette = require('../static/orbit-palette.js');
const source = fs.readFileSync(require.resolve('../static/app.js'), 'utf8');
function extract(start, end) { return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))); }
const context = {
  SugarOrbitPalette: palette, TARGET_MMOL: 6.4,
  svgElement(tag, attrs={}) { return {tag,attrs,children:[],style:{setProperty(){}},appendChild(x){this.children.push(x);}}; }
};
vm.createContext(context);
vm.runInContext(extract('  function midpoint(', '  function closedSmoothPath(') +
  extract('  function chunksFor(', '  function zone(') +
  extract('  function shapedPoints(', '  function interpolatePoints(') +
  extract('  function artRing(', '  let revealTimer'), context);
const points = [{minute:0,value:3},{minute:5,value:6},{minute:10,value:12},{minute:80,value:5},{minute:85,value:7}];
const ring=context.artRing(points,0,360,363,200,10);
const paths=ring.children.filter(n=>n.tag==='path');
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
assert.equal(context.artRing([],1,360,363,200,10).children.filter(n=>n.tag==='path').length,0);
const listeners={};let now=0,changes=0;
Object.assign(context,{
 stage:{addEventListener:(n,f)=>(listeners[n]??=[]).push(f),classList:{add(){},remove(){}}},
 roundDisplayLayout:{matches:true},phoneLayout:{matches:false},introVortex:{hidden:true},
 performance:{now:()=>now},navigator:{},threeFingerGestureActive:false,
 mobileSelectedDay:null,clearCurrentDay(){},currentPeriodOffset:0,showHistoryPeriod(){return true},
 viewMode:'art',applyViewMode(){changes++},revealArt(){}
});
vm.runInContext(extract('  let swipeStart = null;', '  window.addEventListener("keydown"'),context);
function fire(type,id,x,y=200) {now+=100; for(const f of listeners[type]||[]) f({pointerId:id,pointerType:'touch',isPrimary:id===1,clientX:x,clientY:y,preventDefault(){}});}
function swipe(from,to) {fire('pointerdown',1,from);fire('pointerup',1,to);}
swipe(400,300);assert.equal(context.viewMode,'days');
swipe(400,300);assert.equal(context.viewMode,'patterns');
swipe(400,300);assert.equal(changes,2,'Do not wrap at the last view');
swipe(300,400);assert.equal(context.viewMode,'days');
swipe(300,400);assert.equal(context.viewMode,'art');
fire('pointerdown',1,400);fire('pointerdown',2,450);fire('pointerup',2,450);fire('pointerup',1,300);assert.equal(context.viewMode,'art');
fire('pointerdown',1,400);fire('pointercancel',1,400);fire('pointerup',1,300);assert.equal(context.viewMode,'art');
console.log('Art geometry, palette, missing-data gaps and three-view gesture checks passed.');
