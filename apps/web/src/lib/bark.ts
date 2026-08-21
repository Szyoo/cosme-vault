/**
 * Bark 推送封装（基于官方 bark-server API V2，文档见 docs/vendor/bark/bark-server-api-v2.md）。
 *
 * Bark 无交互式按钮/选项回传，因此「需要用户选择」的场景用 url 参数带深链接：
 * 手机点通知 → 打开选择页 → 用户选完回传。
 */

interface BarkOptions {
  title?: string;
  subtitle?: string;
  body: string;
  /** 点击通知跳转的 URL（我们的选择页深链接） */
  url?: string;
  /** 通知分组（按 cosme 账号分组） */
  group?: string;
  /** 中断级别：needsChoice 用 timeSensitive 穿透勿扰 */
  level?: "critical" | "active" | "timeSensitive" | "passive";
  /** 图标 URL（iOS 15+） */
  icon?: string;
  /** 铃声 */
  sound?: string;
  /** call=1 持续响铃 30 秒（留给失败等重要通知） */
  call?: boolean;
}

/** 发送一条 Bark 通知；未配置 BARK_SERVER/BARK_DEVICE_KEY 时静默跳过 */
export async function sendBark(opts: BarkOptions): Promise<boolean> {
  const server = process.env.BARK_SERVER?.replace(/\/$/, "");
  const deviceKey = process.env.BARK_DEVICE_KEY;
  if (!server || !deviceKey) return false;

  const payload: Record<string, string> = {
    device_key: deviceKey,
    body: opts.body,
  };
  if (opts.title) payload.title = opts.title;
  if (opts.subtitle) payload.subtitle = opts.subtitle;
  if (opts.url) payload.url = opts.url;
  if (opts.group) payload.group = opts.group;
  if (opts.level) payload.level = opts.level;
  if (opts.icon) payload.icon = opts.icon;
  if (opts.sound) payload.sound = opts.sound;
  if (opts.call) payload.call = "1";

  try {
    const res = await fetch(`${server}/push`, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 「奖品需要选择」的专用推送：带深链接到选择页 */
export async function notifyNeedsChoice(params: {
  accountLabel: string;
  presentName: string;
  choiceUrl: string;
}): Promise<boolean> {
  return sendBark({
    title: "需要选择奖品",
    subtitle: params.accountLabel,
    body: `「${params.presentName}」有多个选项，点此选择`,
    url: params.choiceUrl,
    group: params.accountLabel,
    level: "timeSensitive",
  });
}
