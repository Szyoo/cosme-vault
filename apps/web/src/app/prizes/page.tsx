/**
 * 奖品库：从 @COSME 扫描到的奖品活动全集（`presents` 表——全站共享，不属于任何用户）。
 *
 * 两种视图（门户 SSO 下按 `optionalIdentity()` 判定，判定早于任何查库之外的渲染分支）：
 * - **已登录**（或 SSO 关闭、proxy 已保证本地会话）：与控制台同一套列表——各账号状态、
 *   按状态筛选、404 改判、行进 `/presents/<id>` 详情（含单独应募），顶部有扫描/投递按钮。
 * - **匿名访客**（`X-Portal-Anon: 1`，proxy 的 `ANON_PAGES` 放进来的）：只读。只出奖品
 *   活动本身（名称、品牌、类型、数量、期间、图片、是否还在募集），账号维度在服务端就剥掉
 *   （`toLibraryItems({ publicOnly: true })`），不渲染任何会调写接口的控件；行链接到
 *   @COSME 原页。写接口（`/api/runs` 等）本身照旧由 proxy 对匿名返回 401，这里只是不调。
 *
 * 分页（2026-10-02）：筛选与分页都在**服务端**按 URL（`?type=&q=&life=&status=&page=`）做，
 * 先筛后切页，每页 `PRIZES_PAGE_SIZE` 条（见 library.ts）。行用服务端渲染的
 * `present-row.tsx`，只有当前页的行进 HTML；`status` 参数对匿名直接忽略。
 */
import { headers } from "next/headers";
import { ssoEnabled } from "@szyyw/auth";
import { optionalIdentity } from "@szyyw/auth/next";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/index.ts";
import { getT } from "@/i18n/server.ts";
import { Nav } from "../nav.tsx";
import { RunButton } from "../run-button.tsx";
import { PublicRow, Row } from "../present-row.tsx";
import { toLibraryItems } from "../present-item.ts";
import { filterAndPage, parseQuery } from "./library.ts";
import { LibraryFilters, LibraryOverview, Pager } from "./views.tsx";

export const dynamic = "force-dynamic";

export default async function PrizesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getT();
  const anon = ssoEnabled() && !optionalIdentity(await headers());
  const query = parseQuery(await searchParams, { allowStatus: !anon });

  const presents = db
    .select({
      id: schema.presents.id,
      name: schema.presents.name,
      brand: schema.presents.brand,
      imageUrl: schema.presents.imageUrl,
      period: schema.presents.period,
      quantity: schema.presents.quantity,
      source: schema.presents.source,
      link: schema.presents.link,
    })
    .from(schema.presents)
    // 同一时刻扫到的奖品按 id 定序：分页要求顺序稳定，否则翻页可能重复/漏行
    .orderBy(desc(schema.presents.scannedAt), asc(schema.presents.id))
    .all();

  // 账号状态只用来算奖品自身的 life（gone/expired 是 runner 在站点上看到的奖品事实）；
  // 匿名视图里 toLibraryItems 会把账号维度整个剥掉，不出服务端
  const rows = db
    .select({
      presentId: schema.accountPresents.presentId,
      accountId: schema.accountPresents.accountId,
      status: schema.accountPresents.status,
      error: schema.accountPresents.error,
      at: schema.accountPresents.updatedAt,
      name: schema.presents.name,
      brand: schema.presents.brand,
      imageUrl: schema.presents.imageUrl,
      period: schema.presents.period,
      quantity: schema.presents.quantity,
      source: schema.presents.source,
    })
    .from(schema.accountPresents)
    .leftJoin(schema.presents, eq(schema.presents.id, schema.accountPresents.presentId))
    .all();
  const accounts = anon ? [] : db.select({ id: schema.accounts.id, label: schema.accounts.label }).from(schema.accounts).all();

  const items = toLibraryItems(presents, rows, accounts, t, { publicOnly: anon });

  const { rows: shown, matched, page, pages } = filterAndPage(items, query, t);
  const pager = <Pager query={query} page={page} pages={pages} matched={matched} total={items.length} t={t} />;

  return (
    <main className="page">
      <Nav current="/prizes" anon={anon} t={t} />

      <div className="row wrap spread">
        <h1 className="page-title">{t.prizes.title}</h1>
        {!anon && <RunButton />}
      </div>
      <p className="page-sub">{t.prizes.sub}</p>
      {anon && <p className="small muted">{t.prizes.anonHint}</p>}

      {items.length > 0 && <LibraryOverview items={items} query={query} t={t} />}

      <section className="glass panel section" id="presents">
        <div className="section-name">{t.present.listTitle}</div>
        {items.length === 0 ? (
          <div className="empty">
            <div>🎁</div>
            <p>{t.prizes.empty}</p>
          </div>
        ) : (
          <>
            <LibraryFilters items={items} query={query} matched={matched} showStatus={!anon} t={t} />
            {pager}
            {shown.length === 0 ? (
              <p className="small muted">{t.filter.noMatch}</p>
            ) : (
              <ul className="plist">
                {shown.map((i) =>
                  anon ? (
                    <PublicRow key={i.presentId} item={i} openSource={t.prizes.openSource} />
                  ) : (
                    <Row key={i.presentId} item={i} statusFilter={query.status} />
                  ),
                )}
              </ul>
            )}
            {pager}
          </>
        )}
      </section>
    </main>
  );
}
