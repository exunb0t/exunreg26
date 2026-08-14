CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`image` text,
	`open_to_all` integer DEFAULT false NOT NULL,
	`eligibility` text,
	`participants` integer DEFAULT 1 NOT NULL,
	`mode` text DEFAULT 'online' NOT NULL,
	`independent_registration` integer DEFAULT true NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`dates` text,
	`description_long` text,
	`description_short` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_events_name` ON `events` (`name`);--> statement-breakpoint
CREATE TABLE `individual_registrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`fullname` text,
	`user_email` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reason` text NOT NULL,
	`content` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `registrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`team_name` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_registrations_event_user` ON `registrations` (`event_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_registrations_status` ON `registrations` (`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text DEFAULT '' NOT NULL,
	`school_code` text,
	`fullname` text,
	`phone_number` text,
	`principals_email` text,
	`individual` integer DEFAULT false NOT NULL,
	`institution_name` text,
	`address` text,
	`principals_name` text,
	`registrations` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `usr_regs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text,
	`institution` text,
	`event_id` text,
	`p1_name` text,
	`p1_email` text,
	`p1_class` text,
	`p1_phone` text,
	`p2_name` text,
	`p2_email` text,
	`p2_class` text,
	`p2_phone` text,
	`p3_name` text,
	`p3_email` text,
	`p3_class` text,
	`p3_phone` text,
	`p4_name` text,
	`p4_email` text,
	`p4_class` text,
	`p4_phone` text,
	`p5_name` text,
	`p5_email` text,
	`p5_class` text,
	`p5_phone` text,
	`p6_name` text,
	`p6_email` text,
	`p6_class` text,
	`p6_phone` text,
	`p7_name` text,
	`p7_email` text,
	`p7_class` text,
	`p7_phone` text,
	`p8_name` text,
	`p8_email` text,
	`p8_class` text,
	`p8_phone` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_usr_regs_username_event` ON `usr_regs` (`username`,`event_id`);