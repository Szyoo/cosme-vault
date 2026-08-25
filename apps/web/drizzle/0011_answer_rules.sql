CREATE TABLE `answer_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`category` text NOT NULL,
	`keyword` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`note` text,
	`builtin` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `answer_rules_kind_keyword` ON `answer_rules` (`kind`,`keyword`);
