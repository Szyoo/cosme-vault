/**
 * 奖品列表的单行（两行一条的排版，见 present-list.tsx 的说明）。
 * 外壳是设计包的 `.list > .list-row`（悬停、焦点、按下都由包管）；缩略图直接作行的首个子元素，
 * 用本应用的 `.prow-img` 定 52px（包的 `.row-lead > img` 是 36，商品图太小看不清）；
 * 第二行参数是可换行的 `.item-meta`（包的 `.row-sub` 单行省略，状态胶囊会被截掉）。
 *
 * 单独成文件、**不用 hook**：控制台/记录页的客户端列表（present-list.tsx）与奖品库的
 * 服务端分页列表（prizes/page.tsx）共用同一套行。放在服务端渲染时行本身不进 RSC 的
 * 客户端 props，页面体积只跟当前页的行数有关。
 */
import Link from "next/link";
import type { PresentItem } from "./present-item.ts";
import { GoneFix } from "./gone-fix.tsx";

/** 匿名只读行：同一套排版，但不含账号状态，链接到 @COSME 原页（新标签） */
export function PublicRow({ item, openSource }: { item: PresentItem; openSource: string }) {
  const body = (
    <>
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- 外站 CDN 图，不走 next/image
        <img className="prow-img" src={item.imageUrl} alt="" loading="lazy" width={52} height={52} />
      ) : (
        <span className="prow-img prow-img-none" aria-hidden />
      )}
      <span className="row-main">
        <span className="row-title">{item.title}</span>
        <span className="item-meta">
          <span className={`pill ${item.sourcePill}`} title={item.sourceFull}>
            {item.sourceShort}
          </span>
          {item.brand && <span className="item-brand">{item.brand}</span>}
          {item.quantity && <span className="item-tag num">{item.quantity}</span>}
          {item.period && <span className="item-tag num">{item.period}</span>}
        </span>
      </span>
    </>
  );
  return (
    <li>
      {item.link ? (
        <a className="list-row" href={item.link} target="_blank" rel="noopener noreferrer" title={`${item.title} — ${openSource}`}>
          {body}
        </a>
      ) : (
        <div className="list-row">{body}</div>
      )}
    </li>
  );
}

export function Row({ item, statusFilter }: { item: PresentItem; statusFilter: string | null }) {
  // 筛选到 404 时给行内改判入口（所有展示 404 的界面都要有操作）。
  // 控件放在 Link 外面——放里面点下拉会触发整行导航。
  const goneStates = statusFilter === "gone" ? item.accounts.filter((a) => a.status === "gone") : [];
  return (
    <li>
      {/* ⚠️ 必须是 next/link：拦截路由只在**客户端导航**时接管。
          用普通 <a> 会整页加载，直接绕过 modal，筛选状态照样丢。 */}
      <Link className="list-row" href={`/presents/${item.presentId}`} title={item.title}>
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- 外站 CDN 图，不走 next/image
          <img className="prow-img" src={item.imageUrl} alt="" loading="lazy" width={52} height={52} />
        ) : (
          <span className="prow-img prow-img-none" aria-hidden />
        )}

        <span className="row-main">
          <span className="row-title">{item.title}</span>

          <span className="item-meta">
            <span className={`pill ${item.sourcePill}`} title={item.sourceFull}>
              {item.sourceShort}
            </span>
            {/* 各账号在这个奖品上的状态：多账号时带账号短名，单账号时只显示状态 */}
            {item.accounts.map((a) => (
              <span key={a.accountId} className={`pill ${a.statusPill}`} title={`${a.label}${a.error ? ` — ${a.error}` : ""}`}>
                {item.accounts.length > 1 && <span className="pill-who">{a.short} </span>}
                {a.statusLabel}
              </span>
            ))}
            {item.brand && <span className="item-brand">{item.brand}</span>}
            {item.quantity && <span className="item-tag num">{item.quantity}</span>}
            {item.period && <span className="item-tag num">{item.period}</span>}
            {item.at && <span className="item-tag muted num">{item.at}</span>}
          </span>
        </span>
      </Link>
      {goneStates.length > 0 && (
        <div className="prow-fix">
          {goneStates.map((a) => (
            <span key={a.accountId} className="row wrap u-gap-3">
              {item.accounts.length > 1 && <span className="tiny muted">{a.short}</span>}
              <GoneFix accountId={a.accountId} presentId={item.presentId} />
            </span>
          ))}
        </div>
      )}
    </li>
  );
}
