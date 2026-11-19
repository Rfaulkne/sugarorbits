// Build the single file pasted into Supabase's Dashboard editor.
const fs=require('node:fs');
const stats=fs.readFileSync('cloud-phone/rhythm.js','utf8');
const handler=fs.readFileSync('supabase/functions/orbit-coach/handler.js','utf8');
fs.writeFileSync('supabase/functions/orbit-coach/index.ts','// Generated from cloud-phone/rhythm.js and handler.js. Do not edit this bundle directly.\nconst window={};\n'+stats+'\n'+handler);
console.log('Built single-file orbit-coach/index.ts');
