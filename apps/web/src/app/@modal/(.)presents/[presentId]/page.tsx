/**
 * 从列表点进奖品详情时的 **modal 呈现**（拦截路由）。
 *
 * `(.)` = 拦截与本 slot 同层的 `presents/[presentId]`。客户端导航时由这里接管，
 * children slot（也就是列表页）保持挂载 —— 筛选状态因此不丢。
 * 硬刷新/直接访问同一 URL 则走 `app/presents/[presentId]/page.tsx` 的整页版本。
 *
 * ⚠️ 必须用 `next/link` 跳转才会触发拦截；普通 `<a href>` 是整页加载，直接绕过。
 * ⚠️ Next 16：动态段 `params` 必须 await。
 */
import { getT } from "@/i18n/server.ts";
import { ModalShell } from "../../../modal-shell.tsx";
import { PresentDetailBody } from "../../../presents/[presentId]/detail.tsx";

export const dynamic = "force-dynamic";

export default async function PresentModal({ params }: { params: Promise<{ presentId: string }> }) {
  const { presentId } = await params;
  const t = await getT();

  return (
    <ModalShell>
      <PresentDetailBody presentId={presentId} t={t} />
    </ModalShell>
  );
}
