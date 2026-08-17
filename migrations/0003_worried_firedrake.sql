ALTER TABLE `password_reset_otps` ADD `request_count` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `password_reset_otps` ADD `request_day` text DEFAULT '' NOT NULL;