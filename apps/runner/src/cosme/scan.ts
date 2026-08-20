/**
 * 奖品扫描：抓两个来源的列表页，解析成 Present。
 *
 * 两个来源的卡片结构差别很大（见 `@cosme/core` 的 `LIST_CARD`），故各有一个解析器；
 * 与 draw 一样遵循「不认识就报告，别装作没有」：某来源解析出 0 个时，
 * 区分「确实没有奖品」与「版式没认出来」——后者回传诊断包供补解析器。
 *
 * 图片一律经 `validateImageUrl` 过滤，见该函数注释里列的四种「抓错图」陷阱。
 */
import type { Page } from "playwright";
import type { Present, PresentSource, ScanSourceReport } from "@cosme/contract";
import { selectors, validateImageUrl } from "@cosme/core";
import { collectDiagnostics } from "./patterns/index.ts";

/** 解析器从页面里取到的原始卡片数据（未经校验） */
interface RawCard {
  /** 站点上的稳定标识（brandcollection 用 present_id，brandFanClub 用 article id） */
  siteId: string;
  link: string;
  title: string;
  brand: string | null;
  period: string | null;
  imageRaw: string | null;
}

export interface ScanOutcome {
  presents: Present[];
  report: ScanSourceReport;
}

/** brandcollection：无语义 class，靠 li 结构定位 */
async function parseNormal(page: Page): Promise<RawCard[]> {
  const sel = selectors.LIST_CARD.normal;
  return page.evaluate((sel: typeof selectors.LIST_CARD.normal) => {
    const seen = new Map<string, ReturnType<typeof mk>>();
    const mk = (o: { siteId: string; link: string; title: string; brand: string | null; period: string | null; imageRaw: string | null }) => o;
    for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>(sel.anchor))) {
      const id = (a.href.match(/present_id\/(\d+)/) ?? [])[1];
      if (!id) continue;
      const card = a.closest(sel.card) ?? a.parentElement;
      if (!card) continue;

      const brand = card.querySelector(sel.brand)?.textContent?.trim() ?? null;
      const ddText = card.querySelector(sel.title)?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      // dd 文本形如「标题…（8/19～8/25）」，末尾括号里是期间
      const m = ddText.match(/^(.*?)（([^）]*\d[^）]*)）\s*$/);
      const title = (m?.[1] ?? ddText).trim();
      const period = m?.[2]?.trim() ?? null;
      // ⚠️ 图片只在卡片的图片容器里取，避免抓到站点图标
      const imageRaw = card.querySelector(sel.image)?.getAttribute("src") ?? null;

      const prev = seen.get(id);
      if (!prev || (!prev.title && title) || (!prev.brand && brand)) {
        seen.set(id, {
          siteId: id,
          link: `https://www.cosme.net/brandcollection/present/detail/present_id/${id}`,
          title: title || prev?.title || "",
          brand: brand || prev?.brand || null,
          period: period ?? prev?.period ?? null,
          imageRaw: imageRaw || prev?.imageRaw || null,
        });
      }
    }
    return Array.from(seen.values());
  }, sel);
}

/** brandFanClub：有语义 class，入口是 /beautist/article/<ID>（没有 present_id） */
async function parseBrandFanClub(page: Page): Promise<RawCard[]> {
  const sel = selectors.LIST_CARD.brandFanClub;
  return page.evaluate((sel: typeof selectors.LIST_CARD.brandFanClub) => {
    const seen = new Map<string, ReturnType<typeof mk>>();
    const mk = (o: { siteId: string; link: string; title: string; brand: string | null; period: string | null; imageRaw: string | null }) => o;
    for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>(sel.anchor))) {
      const id = (a.href.match(/\/beautist\/article\/(\d+)/) ?? [])[1];
      if (!id) continue;
      const card = a.closest(sel.card) ?? a;

      // 只认带 .psnt-ttl 的卡片：页面上还有很多指向 article 的普通文章链接
      const titleEl = card.querySelector(sel.title);
      if (!titleEl) continue;
      const title = titleEl.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (!title) continue;

      // 品牌名在 dt 里、`.psnt-ttl` 之后的「 / 品牌」部分
      const dtText = card.querySelector(sel.brandInDt)?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const afterTitle = dtText.startsWith(title) ? dtText.slice(title.length) : dtText;
      const brand = afterTitle.replace(/^\s*\/\s*/, "").trim() || null;

      // 数量/形式（「計5名様 現品」）当作说明存起来
      const qty = card.querySelector(sel.quantity)?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const copy = card.querySelector(sel.copy)?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const period = [qty, copy].filter(Boolean).join(" · ") || null;

      // ⚠️ 这里的 img 带 onerror 占位图，交给 validateImageUrl 过滤
      const imageRaw = card.querySelector(sel.image)?.getAttribute("src") ?? null;

      if (!seen.has(id)) {
        seen.set(id, {
          siteId: id,
          link: `https://www.cosme.net/beautist/article/${id}`,
          title,
          brand,
          period,
          imageRaw,
        });
      }
    }
    return Array.from(seen.values());
  }, sel);
}

const PARSERS: Record<PresentSource, (page: Page) => Promise<RawCard[]>> = {
  normal: parseNormal,
  brandFanClub: parseBrandFanClub,
};

/**
 * 奖品 id 的命名：
 * - normal 用站点的 present_id 原值（历史数据已如此，不改）
 * - brandFanClub 用 `bfc-<articleId>` 前缀，避免与 present_id 的数字空间撞号
 */
function presentId(source: PresentSource, siteId: string): string {
  return source === "brandFanClub" ? `bfc-${siteId}` : siteId;
}

/** 扫描单个来源 */
export async function scanSource(page: Page, source: PresentSource): Promise<ScanOutcome> {
  const url = selectors.LIST_URLS[source];
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40_000 });

  const raw = await PARSERS[source](page);
  const scannedAt = new Date().toISOString();

  const presents: Present[] = raw
    .filter((r) => r.title) // 标题为空说明没解析到卡片正文，宁可丢弃也不入库脏数据
    .map((r) => ({
      id: presentId(source, r.siteId),
      source,
      link: r.link,
      name: r.title,
      brand: r.brand,
      // 只用页面上真实存在的地址；占位图/站点图标一律过滤成 null。
      // ⚠️ 刻意不按 ID 构造 URL——实测过后缀会变（12053 是 .jpg 不是 .png）
      imageUrl: validateImageUrl(r.imageRaw),
      description: r.period,
      scannedAt,
    }));

  if (presents.length > 0) {
    const withImage = presents.filter((p) => p.imageUrl).length;
    return {
      presents,
      report: {
        source,
        presentCount: presents.length,
        recognized: true,
        note: withImage < presents.length ? `${presents.length - withImage} 个未取到有效图片` : "",
        diagnostics: null,
      },
    };
  }

  // ── 判断「没有奖品」还是「没认出版式」 ──
  const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  const explicitlyEmpty = /現在.*(募集|プレゼント).*(ありません|ございません)|該当する.*ありません|開催予定/.test(body);
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
      note: "未解析到任何奖品卡片，且页面未明示无募集——该来源版式可能已改",
      diagnostics: await collectDiagnostics(page, [
        { name: `list:${source}`, reason: `按 ${source} 的卡片结构未匹配到条目` },
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
