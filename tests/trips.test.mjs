import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { normalizeTrip, summarize, validDay, dayInAlmaty, TripError } from '../lib/trips.ts';
import { saveTrip } from '../lib/trip-service.ts';
const seed = JSON.parse(readFileSync(new URL('../data/trips.json', import.meta.url)));
const sample = seed.slice(0, 2);
const row = async v => ({ ...await normalizeTrip(v), demo: 0, created_at: '2026-10-08T00:00:00Z' });
function database() {
  const sqlite = new DatabaseSync(':memory:');
  for (const name of readdirSync(new URL('../drizzle', import.meta.url)).filter(x=>x.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL('../drizzle/'+name, import.meta.url), 'utf8'));
  const db = { prepare(sql) { return { bind(...args) { return {
    async run() { const info = sqlite.prepare(sql).run(...args); return { meta: { changes: Number(info.changes) } }; },
    async first() { return sqlite.prepare(sql).get(...args) ?? null; }
  }; } }; } };
  return { db, sqlite };
}
test('exact assignment example: 2 trips, 3900 revenue, 585 fee, 3315 net', async()=>{
  assert.deepEqual(summarize(await Promise.all(sample.map(row))), { count:2,revenue:3900,commission:585,net:3315,cash:1500,card:2400,duration:37,cashCount:1,cardCount:1 });
});
test('empty day is all zeros',()=>assert.deepEqual(summarize([]), {count:0,revenue:0,commission:0,net:0,cash:0,card:0,duration:0,cashCount:0,cardCount:0}));
test('fractional tenge are summed exactly in integer tiyn',async()=>{
  const rows = await Promise.all([0.1,0.2].map((amount,i)=>row({...sample[0],id:'decimal-'+i,amount,commission:0.01})));
  const s=summarize(rows);assert.equal(s.revenue,0.3);assert.equal(s.commission,0.02);assert.equal(s.net,0.28);
});
test('reject invalid amounts, commission, payment, date and end <= start',async()=>{
  for(const patch of [{amount:0},{amount:-5},{amount:'100'},{amount:0.001},{amount:NaN},{commission:-1},{commission:2401},{payment:'crypto'},{end:sample[0].start},{end:'2026-10-01T08:00:00+05:00'},{start:'2026-02-30T08:00:00+05:00'},{start:'2026-10-01T08:00:00'},{id:'bad id'}])
    await assert.rejects(normalizeTrip({...sample[0],...patch}), e=>e instanceof TripError && e.status===400);
});
test('zero commission and 100 percent commission are valid',async()=>{
  assert.equal((await normalizeTrip({...sample[0],commission:0})).commission,0);
  assert.equal(summarize([await row({...sample[0],commission:2400})]).net,0);
});
test('same ID repeated: returns existing trip, changes count only once',async()=>{
  const {db,sqlite}=database();try{const a=await saveTrip(db,sample[0]);const b=await saveTrip(db,sample[0]);assert.equal(a.duplicate,false);assert.equal(b.duplicate,true);assert.equal(a.trip.id,b.trip.id);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM trips').get().n,1);}finally{sqlite.close();}
});
test('same content with a new ID cannot create a duplicate',async()=>{
  const {db,sqlite}=database();try{await saveTrip(db,sample[0]);const b=await saveTrip(db,{...sample[0],id:'another-id'});assert.equal(b.duplicate,true);assert.equal(b.trip.id,'t1');}finally{sqlite.close();}
});
test('parallel retries are protected by actual SQLite uniqueness',async()=>{
  const {db,sqlite}=database();try{const r=await Promise.all(Array.from({length:16},(_,i)=>saveTrip(db,{...sample[0],id:'parallel-'+i})));assert.equal(r.filter(t=>!t.duplicate).length,1);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM trips').get().n,1);}finally{sqlite.close();}
});
test('reuse ID with changed payload is a conflict, original preserved',async()=>{
  const {db,sqlite}=database();try{await saveTrip(db,sample[0]);await assert.rejects(saveTrip(db,{...sample[0],amount:3000}),e=>e instanceof TripError&&e.status===409);assert.equal(sqlite.prepare('SELECT amount FROM trips WHERE id=?').get('t1').amount,240000);}finally{sqlite.close();}
});
test('equivalent timestamps in different time zones deduplicate',async()=>{
  const a=await normalizeTrip(sample[0]);const b=await normalizeTrip({...sample[0],id:'utc-copy',start:'2026-10-01T03:10:00Z',end:'2026-10-01T03:32:00Z'});assert.equal(a.fingerprint,b.fingerprint);
});
test('Almaty calendar day uses start time, including midnight crossings',async()=>{
  assert.equal(dayInAlmaty('2026-09-30T20:00:00Z'),'2026-10-01');
  const t=await row({...sample[0],start:'2026-10-01T23:50:00+05:00',end:'2026-10-02T00:10:00+05:00'});assert.equal(t.day,'2026-10-01');assert.equal(summarize([t]).duration,20);
});
test('calendar day rejects normalized nonexistent dates',()=>{
  assert.equal(validDay('2026-02-30'),false);assert.equal(validDay('2026-13-01'),false);assert.equal(validDay('2026-10-01'),true);
});
test('SQL day query isolates the example from other demo days and uses index',async()=>{
  const {db,sqlite}=database();try{for(const t of seed)await saveTrip(db,t);const rows=sqlite.prepare('SELECT * FROM trips WHERE day=? ORDER BY start DESC').all('2026-10-01');assert.equal(rows.length,2);assert.equal(summarize(rows).net,3315);const plan=sqlite.prepare('EXPLAIN QUERY PLAN SELECT * FROM trips WHERE day=? ORDER BY start DESC').all('2026-10-01');assert.match(JSON.stringify(plan),/idx_trips_day_start/);}finally{sqlite.close();}
});
