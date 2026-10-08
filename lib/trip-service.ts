import { normalizeTrip, presentTrip, TripError, type TripRow } from './trips.ts';
export async function saveTrip(db: Pick<D1Database, 'prepare'>, input: unknown, demo = false) {
  const t = await normalizeTrip(input);
  // Both the request ID and normalized content are unique in SQLite. The constraint
  // handles concurrent requests atomically; a read-before-insert is insufficient.
  const result = await db.prepare(`INSERT INTO trips (id, start, end, day, amount, commission, payment, fingerprint, demo, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`)
    .bind(t.id, t.start, t.end, t.day, t.amount, t.commission, t.payment, t.fingerprint, demo ? 1 : 0, new Date().toISOString()).run();
  const byId = await db.prepare('SELECT * FROM trips WHERE id = ?').bind(t.id).first<TripRow>();
  if (byId && byId.fingerprint !== t.fingerprint) throw new TripError('С этим идентификатором уже сохранена другая поездка.', 409);
  const row = byId ?? await db.prepare('SELECT * FROM trips WHERE fingerprint = ?').bind(t.fingerprint).first<TripRow>();
  if (!row) throw new Error('Inserted trip could not be read');
  return { trip: presentTrip(row), duplicate: result.meta.changes === 0, day: row.day };
}
