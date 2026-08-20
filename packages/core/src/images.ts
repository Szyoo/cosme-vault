/**
 * 奖品图片的挑选与校验。
 *
 * 「抓错图」在 @COSME 上有四种真实陷阱，都实测遇到过：
 *
 * 1. **站点图标混入**：beautist article 页最前面几张 img 是
 *    `cache-cdn.cosme.net/media/common_headers/*.png` 这类站点头部图标。
 *    裸 `document.querySelector("img")` 会抓到它们。→ 必须限定在卡片的图片容器内。
 * 2. **占位图**：brandFanClub 的 img 带
 *    `onerror="this.src='…/psnt_noimg_m.png'"`。商品图 404 时浏览器会把 src 换成
 *    占位图（onerror 改的是 src 属性本身，读 getAttribute 也一样是占位图），
 *    照抓就会把「无图」存成一个看似正常的 URL。→ 必须按特征拒绝。
 * 3. **构造 URL 想当然**：brandcollection 的图多为
 *    `cache-cdn.cosme.net/media/monitor/<ID>/<ID>.png`，但**实测 12053 是 `.jpg`**。
 *    所以**不要按 ID 拼 URL**，只用页面上真实存在的地址；没有就留空。
 * 4. **协议相对地址**：站点大量使用 `//host/path` 形式，直接存会过不了
 *    契约里的 `z.string().url()` 校验。→ 必须补上 https:。
 */

/** 占位图 / 无图特征。命中即视为「没有图片」 */
const PLACEHOLDER_MARKERS = [
  "psnt_noimg",
  "noimg",
  "no_image",
  "noimage",
  "no-image",
  "placeholder",
  "dummy",
  "blank",
  "spacer",
] as const;

/** 非内容类素材特征（站点装饰）。命中即拒绝 */
const CHROME_MARKERS = [
  "common_headers/",
  "/sprite",
  "/icon_",
  "/icon/",
  "/btn_",
  "/bnr_",
  "/banner",
  "/logo",
] as const;

/**
 * 已知的商品图路径特征。命中其一才认为「像商品图」。
 * 刻意用白名单而非黑名单：站点装饰素材种类太多，穷举不完；
 * 而商品图的托管位置很集中，白名单更不容易放错。
 */
const CONTENT_MARKERS = [
  "/media/monitor/", // brandcollection 的奖品图
  "/media/product/", // brandFanClub 的商品图（fitter.cosme.net）
  "/media/sku", // 商品 SKU 图
] as const;

/** 把协议相对地址补成 https，并去掉查询串里无意义的缓存参数 */
function normalize(raw: string): string | null {
  const src = raw.trim();
  if (!src) return null;
  if (src.startsWith("data:")) return null; // 内联占位
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("/")) return `https://www.cosme.net${src}`;
  if (!/^https?:\/\//i.test(src)) return null;
  return src;
}

/**
 * 校验一个图片地址是否可作为奖品图。
 * 返回规范化后的地址，或 null（表示「没有可用图片」——**宁可留空也不存错的**）。
 */
export function validateImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const url = normalize(raw);
  if (!url) return null;

  const lower = url.toLowerCase();
  if (PLACEHOLDER_MARKERS.some((m) => lower.includes(m))) return null;
  if (CHROME_MARKERS.some((m) => lower.includes(m))) return null;
  if (!CONTENT_MARKERS.some((m) => lower.includes(m))) return null;

  return url;
}
