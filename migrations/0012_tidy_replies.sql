CREATE TABLE `ticket_replies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticket_id` integer NOT NULL REFERENCES `tickets`(`id`) ON DELETE CASCADE,
	`message` text NOT NULL,
	`replied_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
CREATE INDEX `idx_ticket_replies_ticket` ON `ticket_replies` (`ticket_id`);--> statement-breakpoint
INSERT INTO `ticket_replies` (`ticket_id`, `message`, `replied_by`, `created_at`) SELECT `id`, `admin_reply`, `replied_by`, COALESCE(`replied_at`, `created_at`, CURRENT_TIMESTAMP) FROM `tickets` WHERE `admin_reply` IS NOT NULL;--> statement-breakpoint
