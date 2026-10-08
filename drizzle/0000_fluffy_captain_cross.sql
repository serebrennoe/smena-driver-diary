CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`day` text NOT NULL,
	`amount` integer NOT NULL,
	`commission` integer NOT NULL,
	`payment` text NOT NULL,
	`fingerprint` text NOT NULL,
	`demo` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "amount_positive" CHECK("trips"."amount" > 0),
	CONSTRAINT "commission_valid" CHECK("trips"."commission" >= 0 AND "trips"."commission" <= "trips"."amount"),
	CONSTRAINT "payment_valid" CHECK("trips"."payment" IN ('cash', 'card')),
	CONSTRAINT "time_valid" CHECK("trips"."end" > "trips"."start")
);
--> statement-breakpoint
CREATE INDEX `idx_trips_day_start` ON `trips` (`day`,`start`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_trips_fingerprint` ON `trips` (`fingerprint`);