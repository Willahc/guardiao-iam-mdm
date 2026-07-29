CREATE TABLE `installed_applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notebook_id` integer NOT NULL,
	`name` text NOT NULL,
	`version` text NOT NULL,
	`publisher` text NOT NULL,
	`policy_status` text DEFAULT 'allowed' NOT NULL,
	`detected_at` text NOT NULL,
	FOREIGN KEY (`notebook_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `software_commands` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notebook_id` integer NOT NULL,
	`action` text NOT NULL,
	`application_name` text NOT NULL,
	`target_version` text,
	`justification` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`execution_mode` text DEFAULT 'simulated' NOT NULL,
	`requested_by` text NOT NULL,
	`result` text,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`notebook_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE no action
);
