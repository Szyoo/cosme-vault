CREATE TABLE `account_presents` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`present_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`pending_choices` text,
	`resolved_choices` text,
	`error` text,
	`drawn_at` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`present_id`) REFERENCES `presents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_present_uq` ON `account_presents` (`account_id`,`present_id`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`credentials_enc` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`payload` text NOT NULL,
	`trigger` text DEFAULT 'manual' NOT NULL,
	`result` text,
	`error` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`started_at` text,
	`finished_at` text
);
--> statement-breakpoint
CREATE TABLE `presents` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`link` text NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`image_url` text,
	`description` text,
	`scanned_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `presents_link_uq` ON `presents` (`link`);--> statement-breakpoint
CREATE TABLE `runner_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text,
	`at` text NOT NULL,
	`level` text DEFAULT 'info' NOT NULL,
	`text` text NOT NULL
);
