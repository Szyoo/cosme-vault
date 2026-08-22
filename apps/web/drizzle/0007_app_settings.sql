-- 应用设置键值表（Bark 推送配置等，网页可改）。
-- IF NOT EXISTS：开发库可能已手工建过（沙箱内跑不了 drizzle-kit），保持幂等。
CREATE TABLE IF NOT EXISTS `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
