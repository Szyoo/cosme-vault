-- 把 presents.description 拆成语义明确的三列。
-- 起因：description 被界面当「期间」展示，但扫描时往里塞了「数量 · 文案」
-- （如「計5名様現品 · うるおいケアしながら…」），字段语义混乱。
-- 手写而非 drizzle-kit generate：它会把这当成「改名还是删列」的歧义并要求交互确认。
ALTER TABLE `presents` ADD `period` text;--> statement-breakpoint
ALTER TABLE `presents` ADD `quantity` text;--> statement-breakpoint
ALTER TABLE `presents` ADD `tagline` text;--> statement-breakpoint
-- 旧数据搬迁：只有形如「8/19～8/25」的才算期间，其余归入数量/文案，稍后由 audit 重抓校正
UPDATE `presents` SET `period` = `description`
  WHERE `description` IS NOT NULL AND `description` GLOB '*[0-9]/[0-9]*' AND `description` NOT LIKE '%名様%';--> statement-breakpoint
UPDATE `presents` SET `quantity` = `description`
  WHERE `description` IS NOT NULL AND `description` LIKE '%名様%';--> statement-breakpoint
ALTER TABLE `presents` DROP COLUMN `description`;
