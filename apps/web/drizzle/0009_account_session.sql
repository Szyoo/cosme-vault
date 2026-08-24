-- 账号最近一次「会话有效」的证明时刻（成功的 scan/draw/login 任务都算证明）。
-- 驱动设置页「激活登录」按钮的显隐：近期有证明就不显示。
ALTER TABLE `accounts` ADD `session_ok_at` text;
