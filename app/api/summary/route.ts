import { GET as getTrips } from '../trips/route';
import type { Summary } from '@/lib/trips';
import { json } from '@/lib/api';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const response = await getTrips(request);
  if (!response.ok) return response;
  const { date, timezone, currency, summary } = await response.json() as { date: string; timezone: string; currency: string; summary: Summary };
  return json({ date, timezone, currency, ...summary });
}
