-- 做题时顺手采下的问卷题库（题号/题干/选项），供后续重建匹配库。
-- 按 present_id 每奖品存最新一份（问卷内容基本不变，历史意义不大）。
CREATE TABLE IF NOT EXISTS `survey_captures` (
	`present_id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`questions` text NOT NULL,
	`captured_at` text NOT NULL
);
