const fs=require('node:fs');
const common='const window={};\n'+fs.readFileSync('cloud-phone/rhythm.js','utf8')+'\n'+fs.readFileSync('cloud-phone/focus-core.js','utf8')+'\n';
for(const name of ['orbit-focus','orbit-reminders']){const file=`supabase/functions/${name}/handler.js`;if(fs.existsSync(file))fs.writeFileSync(`supabase/functions/${name}/index.ts`,'// Generated single-file dashboard deployment. See PHONE_APP_SETUP.md.\n'+common+fs.readFileSync(file,'utf8'));}
console.log('Built focus function bundles.');
