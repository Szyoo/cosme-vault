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
  /** **只放日期区间**，取不到就 null——别用数量/文案凑（踩过） */
  period: string | null;
  /** 数量与形式，如「計20名様現品」 */
  quantity: string | null;
  /** 一句话文案 */
  tagline: string | null;
  imageRaw: string | null;
}

/** 浏览器上下文里构造卡片用的形状（page.evaluate 里看不到 interface 声明） */
type RawCardShape = {
  siteId: string;
  link: string;
  title: string;
  brand: string | null;
  period: string | null;
  quantity: string | null;
  tagline: string | null;
  imageRaw: string | null;
};

export interface ScanOutcome {
  presents: Present[];
  report: ScanSourceReport;
}

/** brandcollection：无语义 class，靠 li 结构定位 */
async function parseNormal(page: Page): Promise<RawCard[]> {
  const sel = selectors.LIST_CARD.normal;
  return page.evaluate((sel: typeof selectors.LIST_CARD.normal) => {
    const seen = new Map<string, ReturnType<typeof mk>>();
    const mk = (o: { siteId: string; link: string; title: string; brand: string | null; period: string | null; quantity: string | null; tagline: string | null; imageRaw: string | null }) => o;
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
          quantity: null,
          tagline: null,
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
    const mk = (o: { siteId: string; link: string; title: string; brand: string | null; period: string | null; quantity: string | null; tagline: string | null; imageRaw: string | null }) => o;
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

      // 数量与文案是**两个不同的字段**，不要合并进期间（列表页没有期间，留给 audit 从详情页补）
      const quantity = card.querySelector(sel.quantity)?.textContent?.replace(/\s+/g, " ").trim() || null;
      const tagline = card.querySelector(sel.copy)?.textContent?.replace(/\s+/g, " ").trim() || null;

      // ⚠️ 这里的 img 带 onerror 占位图，交给 validateImageUrl 过滤
      const imageRaw = card.querySelector(sel.image)?.getAttribute("src") ?? null;

      if (!seen.has(id)) {
        seen.set(id, {
          siteId: id,
          link: `https://www.cosme.net/beautist/article/${id}`,
          title,
          brand,
          period: null,
          quantity,
          tagline,
          imageRaw,
        });
      }
    }
    return Array.from(seen.values());
  }, sel);
}

/**
 * brandFanClubViaBrand：粉丝俱乐部限定里**要多跳一次**的那批（奖品的大头，45/55）。
 *
 * 桌面路径是两跳：
 *   `/brandfanclub/present` 的卡片（只链到品牌主页）
 *   → `/brand/brand_id/<品牌ID>/top`
 *   → 品牌主页上的 `/brands/<品牌ID>/present/<奖品ID>/`
 *
 * 所以这个解析器要真的去访问品牌主页。逐个访问并带停顿，控制请求节奏。
 */
async function parseBrandFanClubViaBrand(page: Page, pace: () => Promise<void>): Promise<RawCard[]> {
  // 第一跳：从列表页取「卡片标题 + 品牌ID」
  const cards = await page.evaluate(() => {
    const out: { brandId: string; title: string; brand: string | null; quantity: string | null; tagline: string | null; imageRaw: string | null }[] = [];
    const seen = new Set<string>();
    for (const t of Array.from(document.querySelectorAll(".psnt-ttl"))) {
      const card = t.closest("li") ?? t.parentElement;
      if (!card) continue;
      const hrefs = Array.from(card.querySelectorAll<HTMLAnchorElement>("a[href]")).map((a) => a.getAttribute("href") ?? "");
      // 有 article 直链的那 10 个走 present-blog，不在此处理
      if (hrefs.some((h) => /\/beautist\/article\//.test(h))) continue;
      const brandId = hrefs.find((h) => /\/brand\/brand_id\/\d+/.test(h))?.match(/\/brand\/brand_id\/(\d+)/)?.[1];
      if (!brandId || seen.has(brandId)) continue;
      seen.add(brandId);

      const dt = card.querySelector("dt")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const title = (t.textContent ?? "").replace(/\s+/g, " ").trim();
      const brand = dt.startsWith(title) ? dt.slice(title.length).replace(/^\s*\/\s*/, "").trim() || null : null;
      const quantity = card.querySelector(".psnt-num")?.textContent?.replace(/\s+/g, " ").trim() || null;
      const tagline = card.querySelector(".psnt-copy")?.textContent?.replace(/\s+/g, " ").trim() || null;
      out.push({ brandId, title, brand, quantity, tagline, imageRaw: card.querySelector("img")?.getAttribute("src") ?? null });
    }
    return out;
  });

  // 第二跳：逐个进品牌主页取奖品地址
  const result: RawCard[] = [];
  for (const c of cards) {
    try {
      await page.goto(selectors.brandTopUrl(c.brandId), { waitUntil: "domcontentloaded", timeout: 35_000 });
      const found = await page.evaluate(() => {
        for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/present/"]'))) {
          const m = (a.getAttribute("href") ?? "").match(/\/brands\/(\d+)\/present\/(\d+)/);
          if (m) return { brandId: m[1]!, presentId: m[2]! };
        }
        return null;
      });
      if (found) {
        result.push({
          siteId: found.presentId,
          link: selectors.brandPresentUrl(found.brandId, found.presentId),
          title: c.title,
          brand: c.brand,
          period: null, // 列表页没有期间，由 audit 从详情页补
          quantity: c.quantity,
          tagline: c.tagline,
          imageRaw: c.imageRaw,
        });
      }
    } catch {
      // 单个品牌页打不开就跳过，不影响整轮
    }
    await pace();
  }
  return result;
}


/**
 * produceMember：`/present/` 上「プロデュースメンバー限定プレゼント」那批。
 *
 * ⚠️ 必须按 **pathname 前缀**严格判断：`a[href*="/present/detail/present_id/"]`
 * 会把 `/brandcollection/present/detail/present_id/` 也匹配进来（踩过：12057/12054
 * 被串成了本来源，且字段全错位）。
 */
async function parseProduceMember(page: Page): Promise<RawCard[]> {
  return page.evaluate(() => {
    const PREFIX = "/present/detail/present_id/";
    const seen = new Map<string, RawCardShape>();

    for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
      let path: string;
      try {
        path = new URL(a.href).pathname;
      } catch {
        continue;
      }
      if (!path.startsWith(PREFIX)) continue;
      const id = path.slice(PREFIX.length).replace(/\/.*$/, "");
      if (!/^\d+$/.test(id) || seen.has(id)) continue;

      const card = a.closest("li.clearfix") ?? a.closest("li") ?? a.parentElement;
      if (!card) continue;

      const brand = card.querySelector("dt > a")?.textContent?.replace(/\s+/g, " ").trim() || null;
      const title =
        card.querySelector("dt span a")?.textContent?.replace(/\s+/g, " ").trim() ||
        card.querySelector("p.photo img")?.getAttribute("alt")?.trim() ||
        "";
      const qty = card.querySelector(".prize-point")?.textContent?.replace(/\s+/g, " ").trim() || null;
      // 文案在 dd>p 里，但那段也含数量，去掉数量部分
      const ddText = card.querySelector("dd p")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const tagline = (qty ? ddText.replace(qty, "") : ddText).trim() || null;

      if (!title) continue;
      seen.set(id, {
        siteId: id,
        link: `https://www.cosme.net/present/detail/present_id/${id}`,
        brand,
        title,
        period: null,
        quantity: qty,
        tagline,
        imageRaw: card.querySelector("p.photo img")?.getAttribute("src") ?? null,
      });
    }
    return Array.from(seen.values());
  });
}

/**
 * tieupCampaign：`/present/` 上「ブランドからの新着プレゼント」那批（タイアップ／PR）。
 *
 * ⚠️ 链接是**外部追踪跳转** `https://c.w1.to/c?id=<N>`，不是 cosme.net 路径——
 * 按域名过滤链接会把这批奖品全部漏掉（踩过）。
 * 追踪链最终汇入已支持的 `/enquete/confirm` 流程，故 draw 侧不需要新模式。
 */
async function parseTieupCampaign(page: Page): Promise<RawCard[]> {
  return page.evaluate(() => {
    const seen = new Map<string, RawCardShape>();
    for (const li of Array.from(document.querySelectorAll<HTMLElement>("ul.presentList li"))) {
      const a = li.querySelector<HTMLAnchorElement>('a[href*="c.w1.to"]');
      if (!a) continue;
      const id = a.getAttribute("href")?.match(/id=(\d+)/)?.[1];
      if (!id || seen.has(id)) continue;

      const brand =
        Array.from(li.querySelectorAll<HTMLAnchorElement>("p.text02 a"))
          .map((x) => (x.textContent ?? "").trim())
          .find((t) => t.length > 0) ?? null;
      const copy = li.querySelector("span.small")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const period = li.querySelector("span.pink02")?.textContent?.replace(/\s+/g, " ").trim() || null;
      const quantity = copy.match(/(?:現品)?\s*\d+\s*名様/)?.[0]?.replace(/\s+/g, "") ?? null;

      // 期间已过的直接跳过，别把过期奖品扫进来白占一次投递
      if (period) {
        const end = period.match(/[～~]\s*(\d{1,2})\/(\d{1,2})/);
        if (end) {
          const now = new Date();
          const endDate = new Date(now.getFullYear(), Number(end[1]) - 1, Number(end[2]), 23, 59);
          // 跨年时（12月→1月）结束月小于当前月，按次年算
          if (Number(end[1]) < now.getMonth() + 1 - 6) endDate.setFullYear(now.getFullYear() + 1);
          if (endDate < now) continue;
        }
      }

      seen.set(id, {
        siteId: id,
        // 追踪链本身就是入口，直接存它——runner 打开后会被一路重定向到确认页
        link: `https://c.w1.to/c?id=${id}`,
        brand,
        title: copy || brand || `タイアップ ${id}`,
        period,
        quantity,
        tagline: copy || null,
        // 图片：优先 p.image02，退回卡片里任意 img（个别条目版式略有差异）
        imageRaw:
          li.querySelector("p.image02 img")?.getAttribute("src") ??
          li.querySelector("img")?.getAttribute("src") ??
          null,
      });
    }
    return Array.from(seen.values());
  });
}

/** 单跳解析器（只看列表页） */
const SIMPLE_PARSERS: Partial<Record<PresentSource, (page: Page) => Promise<RawCard[]>>> = {
  normal: parseNormal,
  brandFanClub: parseBrandFanClub,
  produceMember: parseProduceMember,
  tieupCampaign: parseTieupCampaign,
};

/**
 * 奖品 id 的命名：
 * - normal 用站点的 present_id 原值（历史数据已如此，不改）
 * - brandFanClub 用 `bfc-<articleId>` 前缀，避免与 present_id 的数字空间撞号
 */
function presentId(source: PresentSource, siteId: string): string {
  if (source === "brandFanClub") return `bfc-${siteId}`;
  // 这批的 id 段（31774…）与 brandcollection（12057…）不重叠，但仍加前缀防将来撞号
  if (source === "brandFanClubViaBrand") return `bp-${siteId}`;
  if (source === "produceMember") return `pm-${siteId}`;
  if (source === "tieupCampaign") return `tu-${siteId}`;
  return siteId;
}

/**
 * 扫描单个来源。
 *
 * ⚠️ mobileAll 必须用**手机 UA** 才拿得到全量列表，故调用方要能提供一个手机上下文的 page
 * （见 `scanSources` 的 `mobilePage`）；用桌面 UA 打开只会得到桌面版内容。
 */
export async function scanSource(
  page: Page,
  source: PresentSource,
  pace: () => Promise<void> = async () => undefined,
): Promise<ScanOutcome> {
  const url = selectors.LIST_URLS[source];
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });

  const raw =
    source === "brandFanClubViaBrand"
      ? await parseBrandFanClubViaBrand(page, pace)
      : await SIMPLE_PARSERS[source]!(page);
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
      period: r.period,
      quantity: r.quantity,
      tagline: r.tagline,
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
    const { presents, report } = await scanSource(page, source, pace);
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
