ALTER TABLE `individual_registrations` ADD `event_id` text;--> statement-breakpoint
CREATE INDEX `idx_individual_regs_user_event` ON `individual_registrations` (`user_id`,`event_id`);