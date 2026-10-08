import { getDb, ensureSeed } from '@/db';
import { presentTrip, summarize, validDay, TripError, type TripRow } from '@/lib/trips';
import { saveTrip } from '@/lib/trip-service';
import { json, apiError } from '@/lib/api';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const day = new URL(request.url).searchParams.get('date');
    if (!validDay(day)) throw new TripError('Укажите корректную дату в формате YYYY-MM-DD.');
    const db = getDb(); await ensureSeed(db);
    const { results } = await db.prepare('SELECT * FROM trips WHERE day = ? ORDER BY start DESC, id ASC').bind(day).all<TripRow>();
    return json({ date: day, timezone: 'Asia/Almaty', currency: 'KZT', trips: results.map(presentTrip), summary: summarize(results) });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return json({ error: 'Недопустимый источник запроса.' }, 403);
    if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'Используйте application/json.' }, 415);
    if (Number(request.headers.get('content-length')) > 8192) return json({ error: 'Слишком большой запрос.' }, 413);
    const raw = await request.text();
    if (raw.length > 8192) return json({ error: 'Слишком большой запрос.' }, 413);
    let input: unknown;
    try { input = JSON.parse(raw); } catch { throw new TripError('Некорректный JSON.'); }
    const db = getDb(); await ensureSeed(db);
    const result = await saveTrip(db, input);
    return json(result, result.duplicate ? 200 : 201);
  } catch (error) { return apiError(error); }
}
