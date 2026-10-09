/**
 * 公开落地页（门户 SSO 匿名模式）。
 *
 * 门卫对公开站点的匿名访客注入 `X-Portal-Anon: 1`、不带身份头；proxy.ts 只放这类请求进 `/`，
 * page.tsx 在 `optionalIdentity()` 为 null 时渲染本组件。**这里不读数据库、不显示任何个人数据**——
 * 数据始终绑定登录用户。对匿名公开的真实板块只有奖品库（`/prizes`，只读），入口按钮在登录旁边。
 *
 * 登录入口两处：右上角设计包的账户菜单（弹门户登录小窗），以及这里的按钮
 * （`/login` 在 SSO 下由 proxy 302 去门户，回跳本站首页）。
 */
import type { Dict } from "@/i18n/dict.ts";
import { Nav } from "./nav.tsx";

export function Landing({ t }: { t: Dict }) {
  return (
    <main className="page">
      <Nav anon t={t} />

      <h1 className="page-title grad-text">{t.appName}</h1>
      <p className="page-sub">{t.appSub}</p>

      <section className="glass panel spot section">
        <p>{t.landing.lead}</p>
        <ul className="stack">
          {t.landing.points.map((p) => (
            <li key={p} className="small">
              {p}
            </li>
          ))}
        </ul>
      </section>

      <section className="glass panel section">
        <div className="row wrap spread">
          <span className="small muted">{t.landing.loginPrompt}</span>
          <span className="row wrap" style={{ gap: 8 }}>
            <a className="btn" href="/prizes" data-landing-prizes>
              {t.landing.prizesButton}
            </a>
            <a className="btn" href="/login" data-landing-login>
              {t.landing.loginButton}
            </a>
          </span>
        </div>
      </section>
    </main>
  );
}
