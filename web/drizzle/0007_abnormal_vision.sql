CREATE TABLE `access_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`tool_id` integer NOT NULL,
	`account_id` integer,
	`source_type` text DEFAULT 'profile' NOT NULL,
	`source_id` integer,
	`expected_state` text NOT NULL,
	`observed_state` text DEFAULT 'unknown' NOT NULL,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`last_verified_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tool_id`) REFERENCES `tools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `identity_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `access_assignments_user_tool_unique` ON `access_assignments` (`user_id`,`tool_id`);--> statement-breakpoint
CREATE TABLE `execution_steps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`execution_id` integer NOT NULL,
	`tool_id` integer,
	`step_key` text NOT NULL,
	`label` text NOT NULL,
	`method` text NOT NULL,
	`status` text DEFAULT 'PLANNED' NOT NULL,
	`assignee` text NOT NULL,
	`due_at` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`result` text,
	`verification_method` text,
	`evidence` text,
	`error` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`execution_id`) REFERENCES `lifecycle_executions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tool_id`) REFERENCES `tools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `execution_steps_execution_key_unique` ON `execution_steps` (`execution_id`,`step_key`);--> statement-breakpoint
CREATE TABLE `identity_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`tool_id` integer NOT NULL,
	`account_identifier` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`observed_status` text DEFAULT 'unknown' NOT NULL,
	`last_verified_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tool_id`) REFERENCES `tools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `identity_accounts_user_tool_unique` ON `identity_accounts` (`user_id`,`tool_id`);--> statement-breakpoint
CREATE TABLE `lifecycle_executions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`execution_type` text NOT NULL,
	`status` text DEFAULT 'PLANNED' NOT NULL,
	`requested_by` text NOT NULL,
	`started_at` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_connectors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'CATALOG_ONLY' NOT NULL,
	`auth_type` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_connectors`("id", "name", "category", "status", "auth_type", "description") SELECT "id", "name", "category", "status", "auth_type", "description" FROM `connectors`;--> statement-breakpoint
DROP TABLE `connectors`;--> statement-breakpoint
ALTER TABLE `__new_connectors` RENAME TO `connectors`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `connectors_name_unique` ON `connectors` (`name`);--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`department` text NOT NULL,
	`device_serial` text,
	`profile_id` integer,
	`notebook_id` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`notebook_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "name", "email", "department", "device_serial", "profile_id", "notebook_id", "status", "created_at") SELECT "id", "name", "email", "department", "device_serial", "profile_id", "notebook_id", "status", "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_device_serial_unique` ON `users` (`device_serial`);