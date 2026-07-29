CREATE TABLE `asset_work_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notebook_id` integer NOT NULL,
	`order_type` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`assignee` text NOT NULL,
	`due_at` text,
	`checklist` text DEFAULT '[]' NOT NULL,
	`notes` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`notebook_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `notebooks` ADD `custody_location` text DEFAULT 'Estoque TI' NOT NULL;--> statement-breakpoint
ALTER TABLE `notebooks` ADD `next_maintenance_at` text;