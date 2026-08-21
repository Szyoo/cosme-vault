/**
 * 平行路由 `@modal` 的兜底：URL 不匹配任何拦截路由时渲染空。
 *
 * 平行路由必须给每个 slot 提供 `default.tsx`，否则**直接访问**（硬刷新）
 * 未匹配的 URL 会 404 —— 这不是可选文件。
 */
export default function ModalDefault() {
  return null;
}
