/**
 * 控制面首页（占位骨架）。
 * 正式 UI 布局以后再做；此处仅确认 monorepo + Next 链路可跑通，并展示 runner 在线状态。
 */
import { getHeartbeat, isRunnerOnline } from "@/lib/runner-state.ts";

export const dynamic = "force-dynamic";

export default function Home() {
  const online = isRunnerOnline();
  const hb = getHeartbeat();
  return (
    <main style={{ maxWidth: 720, margin: "4rem auto", padding: "0 1.5rem" }}>
      <h1>Cosme Vault</h1>
      <p>@COSME 抽奖辅助控制面（v6，Web 化重写骨架）。</p>
      <section style={{ marginTop: "2rem" }}>
        <h2>Runner 状态</h2>
        <p>
          {online ? "🟢 在线" : "⚪️ 离线"}
          {hb ? `　位置：${hb.location}　当前任务：${hb.busyJobId ?? "空闲"}` : ""}
        </p>
      </section>
      <nav style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <a href="/settings">设置 / 账号管理</a>
      </nav>

      <section style={{ marginTop: "2rem", opacity: 0.7 }}>
        <h2>待接入</h2>
        <ul>
          <li>奖品 / 记录页面</li>
          <li>奖品选择页（Bark 深链接目标）</li>
          <li>runner 的 scan / draw / inspect 业务逻辑移植</li>
        </ul>
      </section>
    </main>
  );
}
