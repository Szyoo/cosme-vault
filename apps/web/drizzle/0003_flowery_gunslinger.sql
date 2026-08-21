CREATE TABLE `runner_state` (
	`id` text PRIMARY KEY NOT NULL,
	`location` text NOT NULL,
	`at` text NOT NULL,
	`busy_job_id` text
);
