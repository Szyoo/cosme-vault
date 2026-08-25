/**
 * 问卷自动作答关键词库。
 *
 * 这是整个项目最有价值的资产：移植自初版 DrawScript4COSME 的 Fill.java，
 * 是 2023 年针对 @cosme 问卷人工调教出来的答案词表。问卷里凡是 label 文本
 * 命中下列任一关键词的选项，即勾选——以此实现「无害的、倾向肯定/常见」的自动作答。
 *
 * 注意：
 * - 这是数据资产，不是选择器。选择器另见 selectors.ts，需按 2026 年实际页面重新校验。
 * - 词表可能随 @cosme 问卷改版而需要增补；新增词请保持「安全、常见、无实际承诺风险」的取向。
 * - **这里是「出厂默认值」**。运行时以控制面 `answer_rules` 表为准（设置页可增删改），
 *   经 `RunnerConfig.rules` 下发、`applyRuleOverrides()` 注入；控制面拉不到时回落到这份。
 */

/** 规则的三种用途 */
export type RuleKind = "answer" | "manual" | "negation";

/**
 * 规则的分类**只影响展示**，不影响匹配语义——匹配一律是「命中任一词即成立」。
 * 分成类是因为九十条词平铺出来根本没法看，也无从判断某一类是不是缺词。
 *
 * 用 slug 而不是直接存中文：界面三语，已知 slug 由字典给标签，
 * 用户自建的分类（字典里没有）原样显示。
 */
export interface RuleDef {
  readonly keyword: string;
  readonly category: string;
}

/** 内置分类的 slug（字典 `t.rules.cat.*` 提供三语标签） */
export const BUILTIN_CATEGORIES = [
  "skincare",
  "haircare",
  "makeup",
  "body",
  "oral",
  "channel",
  "concern",
  "effect",
  "attitude",
  "frequency",
  "consent",
] as const;

/**
 * 问卷选项命中即勾选的关键词（与初版 Fill.java 的 keywords 列表一致，仅补了分类）。
 *
 * ⚠️ 只许加词、改分类，**不要删词**——每一条都是当年实跑调教出来的，
 * 删掉哪条会漏答哪类题无从事先判断。要停用某条，用界面上的「停用」而不是删。
 */
export const ANSWER_RULES: readonly RuleDef[] = [
  // ── 护肤品类 ──
  { keyword: "クレンジング料", category: "skincare" },
  { keyword: "化粧水", category: "skincare" },
  { keyword: "乳液", category: "skincare" },
  { keyword: "クリーム", category: "skincare" },
  { keyword: "アイクリーム・ジェル", category: "skincare" },
  { keyword: "ウォーター・ミスト", category: "skincare" },
  { keyword: "スキンケア", category: "skincare" },

  // ── 美发 ──
  { keyword: "シャンプー", category: "haircare" },
  { keyword: "リンス・コンディショナー", category: "haircare" },
  { keyword: "洗い流すトリートメント", category: "haircare" },
  { keyword: "洗い流すトリートメント（ポンプタイプ）", category: "haircare" },
  { keyword: "セミロング", category: "haircare" },

  // ── 彩妆 ──
  { keyword: "アイブロウ", category: "makeup" },
  { keyword: "アイライナー", category: "makeup" },
  { keyword: "アイシャドウ", category: "makeup" },
  { keyword: "チーク", category: "makeup" },
  { keyword: "口紅", category: "makeup" },
  { keyword: "ネイルカラー", category: "makeup" },
  { keyword: "ペンシルタイプ", category: "makeup" },
  { keyword: "リキッドタイプ", category: "makeup" },

  // ── 身体 / 防晒 ──
  { keyword: "ボディクリーム", category: "body" },
  { keyword: "ボディソープ（泡で出てくるタイプ）", category: "body" },
  { keyword: "手洗い", category: "body" },
  { keyword: "スポンジ", category: "body" },
  { keyword: "顔や体に「日焼け止め」を使用", category: "body" },
  { keyword: "日焼け止めを使用している", category: "body" },
  { keyword: "日差しの強い季節", category: "body" },

  // ── 口腔护理 ──
  { keyword: "冷たいものがしみる", category: "oral" },
  { keyword: "ムシ歯になりやすい", category: "oral" },
  { keyword: "歯ブラシ", category: "oral" },

  // ── 购买场所 / 信息源 ──
  { keyword: "デパート・百貨店", category: "channel" },
  { keyword: "化粧品専門店", category: "channel" },
  { keyword: "ドラッグストア", category: "channel" },
  { keyword: "＠ｃｏｓｍｅ", category: "channel" },
  { keyword: "SNS", category: "channel" },

  // ── 肤质 / 困扰 ──
  { keyword: "乾燥肌", category: "concern" },
  { keyword: "乾燥", category: "concern" },
  { keyword: "ニキビ", category: "concern" },
  { keyword: "やや敏感", category: "concern" },
  { keyword: "非常に傷んでいる", category: "concern" },
  { keyword: "「白髪」は全くない", category: "concern" },

  // ── 效果 / 妆效诉求 ──
  { keyword: "保湿", category: "effect" },
  { keyword: "乾燥を防ぐ", category: "effect" },
  { keyword: "うるおい", category: "effect" },
  { keyword: "うるおう", category: "effect" },
  { keyword: "低刺激", category: "effect" },
  { keyword: "を与える", category: "effect" },
  { keyword: "透明感", category: "effect" },
  { keyword: "肌がしっとりする", category: "effect" },
  { keyword: "化粧のりがよい", category: "effect" },
  { keyword: "くずれにくい", category: "effect" },
  { keyword: "仕上がり", category: "effect" },
  { keyword: "ダメージをケアする", category: "effect" },
  { keyword: "美容成分配合である", category: "effect" },
  { keyword: "白くならない", category: "effect" },
  { keyword: "日焼けしない", category: "effect" },
  { keyword: "肌に負担のない", category: "effect" },
  { keyword: "肌に優しい", category: "effect" },
  { keyword: "長さが出る", category: "effect" },
  { keyword: "ボリューム", category: "effect" },
  { keyword: "自然", category: "effect" },
  { keyword: "細くも太くも描ける", category: "effect" },
  { keyword: "描きやすい", category: "effect" },
  { keyword: "水や汗に強い", category: "effect" },
  { keyword: "標準色", category: "effect" },
  { keyword: "しっかり落としたい", category: "effect" },

  // ── 态度 / 意向 ──
  { keyword: "興味がある", category: "attitude" },
  { keyword: "とても満足", category: "attitude" },
  { keyword: "満足している", category: "attitude" },
  { keyword: "嬉しい", category: "attitude" },
  { keyword: "わからない", category: "attitude" },
  { keyword: "商品を購入してみたい", category: "attitude" },
  { keyword: "テスターを使ってみたい", category: "attitude" },
  { keyword: "新しい商品はすぐに試してみたい", category: "attitude" },
  { keyword: "試すのが好きだ", category: "attitude" },
  { keyword: "信頼できるメーカーやブランド", category: "attitude" },
  { keyword: "魅力的だ", category: "attitude" },
  { keyword: "大切だと思う", category: "attitude" },
  { keyword: "気になることがある", category: "attitude" },
  { keyword: "言葉だけは知っている", category: "attitude" },
  { keyword: "使ったことはないが、よく知っている", category: "attitude" },
  { keyword: "使用したことはないが", category: "attitude" },
  { keyword: "施術を受けたことはないし、興味もない", category: "attitude" },
  { keyword: "香りが好き", category: "attitude" },

  // ── 频率 / 程度 / 金额 ──
  { keyword: "1回程度", category: "frequency" },
  { keyword: "ときどきある", category: "frequency" },
  { keyword: "週に", category: "frequency" },
  { keyword: "自宅", category: "frequency" },
  { keyword: "00円以上", category: "frequency" },

  // ── 应募同意（勾了才算完成应募的那类）──
  { keyword: "応募にあたり、選択したブランドを「お気に入り登録」します", category: "consent" },
  { keyword: "上記を確認の上、応募する", category: "consent" },
  { keyword: "全てのブランドをお気に入り登録して応募", category: "consent" },
  { keyword: "応募にあたり", category: "consent" },
];

/**
 * 「需要用户手动选择」的问题标志词。
 * 命中这些文本的问题不自动作答，而是把选项回传给用户在网页上选（如具体奖品款式）。
 * 移植自 Fill.java 中对「ご希望の…お選びください」多奖品选择的特殊处理。
 *
 * ⚠️ 这一类是 **AND**（全部命中才算），与 answer / negation 的 OR 不同——
 * 界面上必须写明，否则加一条词等于把整类判据收紧，反而更难触发。
 */
export const MANUAL_CHOICE_RULES: readonly RuleDef[] = [
  // 「ご希望の」是真正的判别词：普通题目的题干是「当てはまるものを1つお選びください」，
  // 只有让你挑奖品款式的题才会说「ご希望の…」。
  { keyword: "ご希望の", category: "manual" },
  // 「選び」而非「選びください」：站点两种写法都有（お選びください / お選び下さい），
  // 写全会漏掉汉字版（实测确认）。
  { keyword: "選び", category: "manual" },
];

/**
 * 会**反转语义**的标记词。
 *
 * 子串匹配的固有缺陷：`「@cosme以外のWEBサイト」` 只因为含 `@cosme` 就会被选中，
 * 而词库那条词的本意是选 @cosme 本身。命中这些标记的选项一律不自动勾选。
 *
 * ⚠️ 这份列表必须**精确**，不能图省事写「ない」——
 * 「使ったことはないが、よく知っている」正是要选的答案，含「はない」。
 */
export const NEGATION_RULES: readonly RuleDef[] = [
  { keyword: "以外", category: "negation" },
  { keyword: "ではない", category: "negation" },
  { keyword: "ではありません", category: "negation" },
  { keyword: "ません", category: "negation" },
  { keyword: "不要", category: "negation" },
  { keyword: "興味はない", category: "negation" },
];

/** 出厂默认的扁平词表（保留原有导出名，调用方无需改动） */
export const ANSWER_KEYWORDS: readonly string[] = ANSWER_RULES.map((r) => r.keyword);
export const MANUAL_CHOICE_MARKERS: readonly string[] = MANUAL_CHOICE_RULES.map((r) => r.keyword);
export const NEGATION_MARKERS: readonly string[] = NEGATION_RULES.map((r) => r.keyword);

/** 出厂默认的全量规则（控制面首次启动时用它播种 `answer_rules` 表） */
export const DEFAULT_RULES: readonly (RuleDef & { kind: RuleKind })[] = [
  ...ANSWER_RULES.map((r) => ({ ...r, kind: "answer" as const })),
  ...MANUAL_CHOICE_RULES.map((r) => ({ ...r, kind: "manual" as const })),
  ...NEGATION_RULES.map((r) => ({ ...r, kind: "negation" as const })),
];
