/**
 * 点击 + 自己控制「等落地」。
 *
 * ⚠️ 存在的理由是一个把**成功的投递记成失败**的真实事故（2026-08-21 实测）：
 *
 *   提交问卷并应募
 *   任务失败：locator.click: Timeout 30000ms exceeded
 *     - click action done                        ← 已经点出去了
 *     - waiting for scheduled navigations to finish   ← 卡在这
 *
 * Playwright 的 `locator.click()` 默认会等「已排定的导航」结束，站点这一步的跳转
 * 实测能超过 30 秒，于是 click 本身抛超时 → 任务标记失败。可**表单其实已经提交了**，
 * 于是库里记成 failed、界面催人去确认，而站点那边已经应募成功。
 *
 * 这里改成：`noWaitAfter` 点完就返回，落地由我们自己判断，**超时一律不抛**。
 * 判「成功/失败」交给调用方去看页面状态（表单还在不在），而不是让点击的超时来决定。
 */
import type { Locator, Page } from "playwright";

export interface SettleResult {
  urlBefore: string;
  urlAfter: string;
  navigated: boolean;
}

export async function clickAndSettle(
  page: Page,
  target: Locator,
  opts: { clickTimeoutMs?: number; settleMs?: number } = {},
): Promise<SettleResult> {
  const urlBefore = page.url();

  // noWaitAfter：不等导航，避免站点慢跳转把「点成功了」变成异常
  await target.click({ noWaitAfter: true, timeout: opts.clickTimeoutMs ?? 15_000 });

  // 自己等落地：URL 变化优先，其次 DOM 就绪。两个都是 catch 掉超时，不影响流程。
  await page
    .waitForURL((u) => u.href !== urlBefore, { timeout: opts.settleMs ?? 25_000 })
    .catch(() => undefined);
  await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => undefined);

  const urlAfter = page.url();
  return { urlBefore, urlAfter, navigated: urlAfter !== urlBefore };
}

/**
 * 等某个选择器**消失**（用来判断「已经离开表单」）。超时不抛，返回是否真的消失了。
 * 比「URL 变没变」更可靠：站点有的页面是原地替换内容、URL 不变。
 */
export async function waitGone(page: Page, selector: string, timeoutMs = 15_000): Promise<boolean> {
  try {
    await page.locator(selector).first().waitFor({ state: "detached", timeout: timeoutMs });
    return true;
  } catch {
    return (await page.locator(selector).count()) === 0;
  }
}
