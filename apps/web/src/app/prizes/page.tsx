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
 */
import { headers } from "next/headers";
import { ssoEnabled } from "@szyyw/auth";
import { optionalIdentity } from "@szyyw/auth/next";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/index.ts";
import { getT } from "@/i18n/server.ts";
import { Nav } from "../nav.tsx";
import { RunButton } from "../run-button.tsx";
import { PresentList } from "../present-list.tsx";
import { PresentOverview } from "../present-overview.tsx";
import { PresentFilterProvider } from "../present-filter.tsx";
import { toLibraryItems } from "../present-item.ts";

export const dynamic = "force-dynamic";

export default async function PrizesPage() {
  const t = await getT();
  const anon = ssoEnabled() && !optionalIdentity(await headers());

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
    .orderBy(desc(schema.presents.scannedAt))
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

  return (
    <PresentFilterProvider>
      <main className="page">
        <Nav current="/prizes" anon={anon} t={t} />

        <div className="row spread">
          <h1 className="page-title">{t.prizes.title}</h1>
          {!anon && <RunButton />}
        </div>
        <p className="page-sub">{t.prizes.sub}</p>
        {anon && <p className="small muted">{t.prizes.anonHint}</p>}

        {items.length > 0 && <PresentOverview items={items} />}

        <section className="glass section" id="presents">
          <div className="section-name">{t.present.listTitle}</div>
          {items.length === 0 ? (
            <div className="empty">
              <div>🎁</div>
              <p>{t.prizes.empty}</p>
            </div>
          ) : (
            <PresentList items={items} readOnly={anon} />
          )}
        </section>
      </main>
    </PresentFilterProvider>
  );
}
