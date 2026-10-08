export type Payment = 'cash' | 'card';
export type TripRow = { id: string; start: string; end: string; day: string; amount: number; commission: number; payment: Payment; fingerprint: string; demo: number; created_at: string };
export type Trip = { id: string; start: string; end: string; amount: number; commission: number; payment: Payment; net: number; duration: number; demo: boolean };
export type Summary = { count: number; revenue: number; commission: number; net: number; cash: number; card: number; duration: number; cashCount: number; cardCount: number };
export class TripError extends Error {
  status: number; fields: Record<string, string>;
  constructor(message: string, status = 400, fields: Record<string, string> = {}) {
    super(message); this.name = 'TripError'; this.status = status; this.fields = fields;
  }
}
export function validDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
}
export function dayInAlmaty(iso: string) {
  return new Date(Date.parse(iso) + 5 * 3600_000).toISOString().slice(0, 10);
}
function validTime(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  return validDay(value.slice(0, 10)) && Number.isFinite(Date.parse(value)) && Number(value.slice(11, 13)) < 24;
}
function cents(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e9) return null;
  const n = Math.round(value * 100);
  return Math.abs(n - value * 100) < 0.00001 ? n : null;
}
export async function normalizeTrip(input: unknown): Promise<Omit<TripRow, 'demo' | 'created_at'>> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TripError('Ожидается объект поездки.');
  const v = input as Record<string, unknown>, fields: Record<string, string> = {};
  if (!validTime(v.start)) fields.start = 'Укажите корректные дату и время начала.';
  if (!validTime(v.end)) fields.end = 'Укажите корректные дату и время окончания.';
  if (!fields.start && !fields.end && Date.parse(v.end as string) <= Date.parse(v.start as string)) fields.end = 'Окончание должно быть позже начала.';
  const amount = cents(v.amount), commission = cents(v.commission);
  if (amount === null || amount <= 0) fields.amount = 'Сумма должна быть больше нуля, не более 1 млрд ₸ и иметь до двух знаков после запятой.';
  if (commission === null || commission < 0 || (amount !== null && commission > amount)) fields.commission = 'Комиссия должна быть от 0 до суммы поездки, до двух знаков после запятой.';
  if (v.payment !== 'cash' && v.payment !== 'card') fields.payment = 'Выберите оплату наличными или картой.';
  if (v.id !== undefined && (typeof v.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(v.id))) fields.id = 'Некорректный идентификатор поездки.';
  if (Object.keys(fields).length) throw new TripError('Проверьте данные поездки.', 400, fields);
  const start = new Date(v.start as string).toISOString(), end = new Date(v.end as string).toISOString();
  const canonical = JSON.stringify([start, end, amount, commission, v.payment]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return { id: (v.id as string | undefined) ?? crypto.randomUUID(), start, end, day: dayInAlmaty(start), amount: amount!, commission: commission!, payment: v.payment as Payment, fingerprint };
}
export function presentTrip(row: TripRow): Trip {
  return { id: row.id, start: row.start, end: row.end, amount: row.amount / 100, commission: row.commission / 100, payment: row.payment, net: (row.amount - row.commission) / 100, duration: (Date.parse(row.end) - Date.parse(row.start)) / 60_000, demo: !!row.demo };
}
export function summarize(rows: TripRow[]): Summary {
  const result = { count: rows.length, revenue: 0, commission: 0, net: 0, cash: 0, card: 0, duration: 0, cashCount: 0, cardCount: 0 };
  for (const row of rows) {
    result.revenue += row.amount; result.commission += row.commission;
    result[row.payment] += row.amount; result[row.payment === 'cash' ? 'cashCount' : 'cardCount']++;
    result.duration += Date.parse(row.end) - Date.parse(row.start);
  }
  result.net = result.revenue - result.commission;
  for (const key of ['revenue', 'commission', 'net', 'cash', 'card'] as const) result[key] /= 100;
  result.duration /= 60_000;
  return result;
}
