ALTER TABLE `tickets` ADD `category` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `priority` text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE `tickets` ADD `attachments` text DEFAULT '[]' NOT NULL;