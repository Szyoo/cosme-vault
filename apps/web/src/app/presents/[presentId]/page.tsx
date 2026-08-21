/**
 * 奖品详情**整页**：直接访问 URL、或从外部（Bark 推送、分享链接）进来时用这个。
 *
 * 从列表点进来走的是 modal（`app/@modal/(.)presents/[presentId]`）——
 * 那条路才能保住列表的筛选状态。主体两边共用 `PresentDetailBody`。
 *
 * ⚠️ Next 16：动态段 `params` 必须 await。
 */
import { getT } from "@/i18n/server.ts";
import { Nav } from "../../nav.tsx";
import { PresentDetailBody } from "./detail.tsx";

export const dynamic = "force-dynamic";

export default async function PresentPage({ params }: { params: Promise<{ presentId: string }> }) {
  const { presentId } = await params;
  const t = await getT();

  return (
    <main className="page">
      {/* 导航放在**顶部**：底部导航在手机上要滚过整页才看得到，等于退不出去 */}
      <Nav t={t} />
      <PresentDetailBody presentId={presentId} t={t} />
    </main>
  );
}
