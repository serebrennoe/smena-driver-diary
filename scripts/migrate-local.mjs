import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if (!existsSync('dist/server/wrangler.json')) throw new Error('Run pnpm build before local migrations.');
const run = args => { const r=spawnSync(process.execPath, ['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state',...args],{stdio:'inherit'});if(r.status!==0)process.exit(r.status??1); };
// Fresh local setup; schema migrations are idempotently tracked by Wrangler.
run(['--command','CREATE TABLE IF NOT EXISTS smena_local_migrations (name TEXT PRIMARY KEY)']);
for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort()){
 const r=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--command',`SELECT name FROM smena_local_migrations WHERE name='${name}'`,'--json'],{encoding:'utf8'});
 if(r.status!==0){process.stderr.write(r.stderr);process.exit(1);}
 if(JSON.parse(r.stdout).some(x=>x.results?.length))continue;
 run(['--file',`drizzle/${name}`]);run(['--command',`INSERT INTO smena_local_migrations(name) VALUES ('${name}')`]);
}
