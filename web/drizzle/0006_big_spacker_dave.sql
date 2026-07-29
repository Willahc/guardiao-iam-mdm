ALTER TABLE `installed_applications` ADD `source` text DEFAULT 'agent' NOT NULL;--> statement-breakpoint
UPDATE `installed_applications`
SET `source` = 'demo'
WHERE (`name` = 'Microsoft 365 Apps' AND `version` = '2406' AND `publisher` = 'Microsoft')
   OR (`name` = 'Google Chrome' AND `version` = '126.0' AND `publisher` = 'Google')
   OR (`name` = 'AnyDesk' AND `version` = '8.0' AND `publisher` = 'AnyDesk Software');--> statement-breakpoint
DELETE FROM `installed_applications`
WHERE `source` = 'demo'
  AND `notebook_id` <> (SELECT MIN(`id`) FROM `notebooks`);
