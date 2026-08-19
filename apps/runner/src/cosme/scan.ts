/**
 * 奖品扫描：抓两个来源的列表页，解析成 Present。
 *
 * 与 draw 一样遵循「不认识就报告，别装作没有」：某来源解析出 0 个时，
 * 区分「确实没有奖品」与「版式没认出来」——后者回传诊断包供补解析器。
 *
 * 列表卡片结构（2026-08-19 实测 brandcollection）：
 *   <li>
 *     <p class="img"><a href="…/present_id/12057"><img src="…/media/monitor/12057/12057.png"></a></p>
 *     <dl>
 *       <dt><a href="…">ミノン</a></dt>                      ← 品牌
 *       <dd><a href="…">【NEW】…♪<br>（8/19～8/25）</a></dd>  ← 标题 + 期间
 *     </dl>
 *   </li>
 */
import type { Page } from "playwright";
import type { Present, PresentSource, ScanSourceReport } from "@cosme/contract";
import { selectors } from "@cosme/core";
import { collectDiagnostics } from "./patterns/index.ts";

export interface ScanOutcome {
  presents: Present[];
  report: ScanSourceReport;
}

/** 扫描单个来源 */
export async function scanSource(page: Page, source: PresentSource): Promise<ScanOutcome> {
  const url = selectors.LIST_URLS[source];
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40_000 });

  const raw = await page.evaluate(() => {
    const seen = new Map<
      string,
      { id: string; brand: string | null; title: string; period: string | null; imageUrl: string | null }
    >();

    for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="present_id"]'))) {
      const id = (a.href.match(/present_id\/(\d+)/) ?? [])[1];
      if (!id) continue;

      // 以最近的 li 作为整张卡片；没有 li 则退回父元素
      const card = a.closest("li") ?? a.parentElement;
      const brand = card?.querySelector("dt a")?.textContent?.trim() ?? null;
      const ddText = card?.querySelector("dd a")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      // dd 文本形如「标题…（8/19～8/25）」，把末尾括号里的期间拆出来
      const m = ddText.match(/^(.*?)（([^）]*\d[^）]*)）\s*$/);
      const title = (m?.[1] ?? ddText).trim();
      const period = m?.[2]?.trim() ?? null;
      const imageUrl = card?.querySelector("img")?.getAttribute("src") ?? null;

      // 同一奖品有图片/品牌/标题三个锚点，取信息最全的那次
      const prev = seen.get(id);
      if (!prev || (!prev.title && title) || (!prev.brand && brand)) {
        seen.set(id, {
          id,
          brand: brand || prev?.brand || null,
          title: title || prev?.title || "",
          period: period ?? prev?.period ?? null,
          imageUrl: imageUrl || prev?.imageUrl || null,
        });
      }
    }
    return Array.from(seen.values());
  });

  const scannedAt = new Date().toISOString();
  const presents: Present[] = raw
    .filter((r) => r.title) // 标题为空说明没解析到卡片正文，宁可丢弃也不入库脏数据
    .map((r) => ({
      id: r.id,
      source,
      link: selectors.presentDetailUrl(r.id),
      name: r.title,
      brand: r.brand,
      // 图片 URL 有规律，抓不到就按 ID 构造
      imageUrl: r.imageUrl ?? `https://cache-cdn.cosme.net/media/monitor/${r.id}/${r.id}.png`,
      description: r.period,
      scannedAt,
    }));

  // ── 判断「没有奖品」还是「没认出版式」 ──
  if (presents.length > 0) {
    return {
      presents,
      report: { source, presentCount: presents.length, recognized: true, note: "", diagnostics: null },
    };
  }

  const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  // 页面明说当前无募集 → 确实没有，不算失败
  const explicitlyEmpty = /現在.*(募集|プレゼント).*(ありません|ございません)|該当する.*ありません/.test(body);
  if (explicitlyEmpty) {
    return {
      presents: [],
      report: { source, presentCount: 0, recognized: true, note: "页面明示当前无募集", diagnostics: null },
    };
  }

  return {
    presents: [],
    report: {
      source,
      presentCount: 0,
      recognized: false,
      note: `未解析到任何 present_id 卡片，且页面未明示无募集——该来源版式可能与已知不同`,
      diagnostics: await collectDiagnostics(page, [
        { name: `list:${source}`, reason: '页面无 a[href*="present_id"]，或卡片结构非 li>dl>dt/dd' },
      ]),
    },
  };
}

/** 扫描多个来源，合并结果（按 link 去重） */
export async function scanSources(
  page: Page,
  sources: readonly PresentSource[],
  log: (text: string, level?: "info" | "warn" | "error") => Promise<void>,
  pace: () => Promise<void>,
): Promise<{ presents: Present[]; reports: ScanSourceReport[] }> {
  const byLink = new Map<string, Present>();
  const reports: ScanSourceReport[] = [];

  for (const source of sources) {
    const { presents, report } = await scanSource(page, source);
    reports.push(report);
    for (const p of presents) byLink.set(p.link, p);

    await log(
      report.recognized
        ? `来源 ${source}：${report.presentCount} 个奖品${report.note ? `（${report.note}）` : ""}`
        : `来源 ${source}：版式未识别，已回传现场 —— ${report.note}`,
      report.recognized ? "info" : "warn",
    );
    await pace();
  }

  return { presents: Array.from(byLink.values()), reports };
}
