import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex, check } from 'drizzle-orm/sqlite-core';
export const trips = sqliteTable('trips', {
  id: text('id').primaryKey(),
  start: text('start').notNull(),
  end: text('end').notNull(),
  day: text('day').notNull(),
  amount: integer('amount').notNull(),
  commission: integer('commission').notNull(),
  payment: text('payment').notNull(),
  fingerprint: text('fingerprint').notNull(),
  demo: integer('demo').notNull().default(0),
  createdAt: text('created_at').notNull(),
}, (t) => [
  index('idx_trips_day_start').on(t.day, t.start),
  uniqueIndex('idx_trips_fingerprint').on(t.fingerprint),
  check('amount_positive', sql`${t.amount} > 0`),
  check('commission_valid', sql`${t.commission} >= 0 AND ${t.commission} <= ${t.amount}`),
  check('payment_valid', sql`${t.payment} IN ('cash', 'card')`),
  check('time_valid', sql`${t.end} > ${t.start}`),
]);
