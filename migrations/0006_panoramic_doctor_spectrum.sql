CREATE TABLE `queries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `individual_registrations` ADD `phone_number` text;--> statement-breakpoint
ALTER TABLE `individual_registrations` ADD `class` text;--> statement-breakpoint
ALTER TABLE `individual_registrations` ADD `school_name` text;--> statement-breakpoint
ALTER TABLE `individual_registrations` ADD `school_code` text;--> statement-breakpoint
ALTER TABLE `individual_registrations` ADD `address` text;