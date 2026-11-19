const fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync('cloud-phone/index.html','utf8');
const css=fs.readFileSync('cloud-phone/style.css','utf8');
assert.match(html,/name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/);
assert.doesNotMatch(html,/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:[,"\s])/i);
assert.match(css,/input,textarea,select\{font-size:16px;min-width:0;max-width:100%\}/);
assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.match(css,/#camera-dialog\{max-width:calc\(100% - 24px\)/);
console.log('PASS: static viewport, legible field sizes, shrinkable layout and pinch-zoom accessibility checks. Actual iPhone zoom behaviour remains a device check.');
