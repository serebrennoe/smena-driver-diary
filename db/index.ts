import { env } from 'cloudflare:workers';
import seed from '@/data/trips.json';
import { normalizeTrip } from '@/lib/trips';
export function getDb(): D1Database {
  if (!env.DB) throw new Error('Database binding unavailable');
  return env.DB;
}
let seeded: Promise<void> | undefined;
export async function ensureSeed(db: D1Database) {
  if (!seeded) seeded = (async () => {
    const rows = await Promise.all(seed.map(normalizeTrip));
    await db.batch(rows.map(t => db.prepare(`INSERT INTO trips (id, start, end, day, amount, commission, payment, fingerprint, demo, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?) ON CONFLICT DO NOTHING`).bind(t.id,t.start,t.end,t.day,t.amount,t.commission,t.payment,t.fingerprint,'2026-10-08T00:00:00.000Z')));
  })().catch(error => { seeded = undefined; throw error; });
  await seeded;
}
