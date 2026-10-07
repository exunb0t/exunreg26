CREATE TABLE `invite_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`school_name` text,
	`message` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
CREATE INDEX `idx_invite_requests_email` ON `invite_requests` (`email`);--> statement-breakpoint
CREATE INDEX `idx_invite_requests_status` ON `invite_requests` (`status`);--> statement-breakpoint
