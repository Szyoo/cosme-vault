-- 任务分批：让队列以「一轮 / 单独重跑」为单位展示，而不是暴露内部的一奖品一 job。
-- batch_id  同一次操作产生的所有 job 共享
-- batch_kind 'run'（跑一轮，含 scan + 它派发出的 draw）| 'single'（手动点单个奖品）
ALTER TABLE `jobs` ADD `batch_id` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `batch_kind` text;
