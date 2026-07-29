CREATE TABLE `notebooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_tag` text NOT NULL,
	`serial` text NOT NULL,
	`model` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`condition` text DEFAULT 'new' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notebooks_asset_tag_unique` ON `notebooks` (`asset_tag`);--> statement-breakpoint
CREATE UNIQUE INDEX `notebooks_serial_unique` ON `notebooks` (`serial`);--> statement-breakpoint
CREATE TABLE `profile_tools` (
	`profile_id` integer NOT NULL,
	`tool_id` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tool_id`) REFERENCES `tools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_tools_unique` ON `profile_tools` (`profile_id`,`tool_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`color` text DEFAULT '#0b6b4b' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_name_unique` ON `profiles` (`name`);--> statement-breakpoint
CREATE TABLE `tools` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tools_name_unique` ON `tools` (`name`);--> statement-breakpoint
ALTER TABLE `users` ADD `profile_id` integer REFERENCES profiles(id);--> statement-breakpoint
ALTER TABLE `users` ADD `notebook_id` integer REFERENCES notebooks(id);