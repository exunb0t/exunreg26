ALTER TABLE `users` ADD COLUMN `role` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
CREATE TABLE `rate_counters` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
DROP TABLE `usr_regs`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `registrations`;--> statement-breakpoint
DROP TABLE IF EXISTS `invite_requests`;--> statement-breakpoint
CREATE INDEX `idx_registrations_user` ON `registrations` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_email` ON `auth_sessions` (`email`);--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_expires` ON `auth_sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_password_reset_otps_expires` ON `password_reset_otps` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_tickets_user_email` ON `tickets` (`user_email`);--> statement-breakpoint
CREATE INDEX `idx_queries_email` ON `queries` (`email`);--> statement-breakpoint
CREATE INDEX `idx_logs_created` ON `logs` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_kb_chunks_source_index` ON `kb_chunks` (`source_id`, `chunk_index`);--> statement-breakpoint
