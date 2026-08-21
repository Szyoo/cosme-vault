/**
 * 数量（当選数）归一化。
 *
 * 站点同一个概念有一堆写法（实测 138 个奖品里出现 28 种）：
 *
 * | 写法 | 出现次数 |
 * | --- | --- |
 * | `500名様` | 28 |
 * | `計20名様現品` | 27 |
 * | `30名様` | 21 |
 * | `20名` / `3名` / `600名` | 各若干 |
 * | `現品200名様`（形式在前） | 1 |
 *
 * 一律折成 `計{N}名様`，形式（現品 / サンプル / モニター）作为后缀用「・」隔开：
 * `計500名様`、`計20名様・現品`。
 *
 * **为什么形式不一起丢掉**：現品（正装商品）与サンプル（试用装）价值差很远，
 * 是真信息不是格式噪音。数量部分的语法统一之后，界面上看到的就只有
 * 「計N名様」与「計N名様・現品」两种，而后者多出来的是内容不是写法。
 */

/** 形式关键词，按优先级排列（先匹配到的胜出） */
const FORMS = ["現品", "サンプル", "モニター"] as const;

export function normalizeQuantity(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // 全角数字折半角，去掉所有空白
  const s = raw.normalize("NFKC").replace(/\s+/g, "");
  if (!s) return null;

  const form = FORMS.find((f) => s.includes(f)) ?? null;

  // 数字可能带千分位逗号（`1,000名様`）
  const m = s.match(/(\d[\d,]*)\s*名/);
  if (!m) {
    // 认不出数字就原样留着，**宁可不统一也不要瞎猜**（和图片校验同一原则）
    return s;
  }
  const n = m[1]!.replace(/,/g, "");

  // 「各10名様」的「各」是每种各多少，与「計」语义不同，要保留
  const head = s.includes("各") ? "各" : "計";

  return `${head}${n}名様${form ? `・${form}` : ""}`;
}

/** 是否已是归一化后的形状（audit 用来判断库里的值要不要重写） */
export function isNormalizedQuantity(value: string | null | undefined): boolean {
  if (!value) return true;
  return /^[計各]\d+名様(・(現品|サンプル|モニター))?$/.test(value);
}
