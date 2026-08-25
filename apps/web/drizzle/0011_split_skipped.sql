-- 把混合状态 `skipped` 拆成 `expired`（募集已结束）与 `gone`（页面已下架/404）。
--
-- 起因：界面上只有一个「已跳过」，既不知道是奖品过期还是出了问题，也分不清跟
-- 「还没抽」的区别（2026-08-26 用户指出）。理由此前也没入库（error 全是空的）。
--
-- 历史行经 jobs.payload → runner_logs 回溯当时的日志判定，实测 60 行全部可回溯：
-- 写着「已不存在」的 5 行归 gone，其余 55 行归 expired。
-- 顺带把理由补进 error，让旧记录也说得清为什么。
--
-- ⚠️ sqlite 的 CHECK 约束不在这些列上（drizzle 的 enum 只是 TS 层面的），
-- 故不需要重建表，直接 UPDATE 即可。

UPDATE `account_presents`
SET `status` = 'gone',
    `error` = COALESCE(`error`, '页面不存在（历史记录，据 runner 日志回填）')
WHERE `status` = 'skipped'
  AND EXISTS (
    SELECT 1 FROM `jobs` j
    JOIN `runner_logs` l ON l.`job_id` = j.`id`
    WHERE json_extract(j.`payload`, '$.presentId') = `account_presents`.`present_id`
      AND json_extract(j.`payload`, '$.accountId') = `account_presents`.`account_id`
      AND l.`text` LIKE '%已不存在%'
  );
--> statement-breakpoint
UPDATE `account_presents`
SET `status` = 'expired',
    `error` = COALESCE(`error`, '募集已结束（历史记录，据 runner 日志回填）')
WHERE `status` = 'skipped';
