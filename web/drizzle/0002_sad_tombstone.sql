CREATE TABLE `access_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`tool_id` integer NOT NULL,
	`requested_role` text NOT NULL,
	`justification` text NOT NULL,
	`expires_at` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_by` text NOT NULL,
	`approved_by` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tool_id`) REFERENCES `tools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `admin_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`permissions` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_assignments_email_unique` ON `admin_assignments` (`email`);--> statement-breakpoint
CREATE TABLE `asset_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notebook_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`details` text NOT NULL,
	`performed_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`notebook_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `connectors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`auth_type` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connectors_name_unique` ON `connectors` (`name`);--> statement-breakpoint
CREATE TABLE `profile_entitlements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer NOT NULL,
	`tool_id` integer NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`scope` text DEFAULT 'department' NOT NULL,
	`restrictions` text DEFAULT 'Dispositivo gerenciado' NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tool_id`) REFERENCES `tools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recertification_campaigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`due_at` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`total_items` integer NOT NULL,
	`reviewed_items` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `notebooks` ADD `location` text DEFAULT 'Matriz' NOT NULL;--> statement-breakpoint
ALTER TABLE `notebooks` ADD `warranty_until` text;--> statement-breakpoint
ALTER TABLE `notebooks` ADD `encrypted` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `notebooks` ADD `last_seen_at` text;