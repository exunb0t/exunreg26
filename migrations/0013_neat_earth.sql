DELETE FROM `registrations` WHERE `id` NOT IN (SELECT MIN(`id`) FROM `registrations` GROUP BY `event_id`, `user_id`);--> statement-breakpoint
DROP INDEX IF EXISTS `idx_registrations_event_user`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_registrations_event_user` ON `registrations` (`event_id`, `user_id`);--> statement-breakpoint
DELETE FROM `password_reset_otps` WHERE `id` NOT IN (SELECT MAX(`id`) FROM `password_reset_otps` GROUP BY `email`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_password_reset_otps_email` ON `password_reset_otps` (`email`);--> statement-breakpoint
