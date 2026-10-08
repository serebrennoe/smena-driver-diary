import { TripError } from './trips';
export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
export function apiError(error: unknown) {
  if (error instanceof TripError) return json({ error: error.message, fields: error.fields }, error.status);
  console.error('Trip API error', error instanceof Error ? error.message : 'Unknown error');
  return json({ error: 'Не удалось связаться с дневником. Попробуйте ещё раз.' }, 503);
}
