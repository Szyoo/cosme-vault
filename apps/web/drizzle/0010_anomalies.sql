-- 异常聚合：同一种异常（指纹相同）只留一份现场，累计出现次数。
-- 用途：127 个奖品撞同一个登录墙时，诊断页显示「1 种 × 127 次」而不是 127 份重复；
-- 出现次数同时用于判断「是否可复现」——首次可自动重试，重现才需人工。
CREATE TABLE IF NOT EXISTS `anomalies` (
	`fingerprint` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`tried_patterns` text NOT NULL,
	`elements` text NOT NULL,
	`body_excerpt` text NOT NULL,
	`screenshot` text,
	`html_snapshot` text,
	`seen_count` integer DEFAULT 1 NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`resolved_at` text
);
