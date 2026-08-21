/**
 * GET /api/events —— SSE：把 runner 的动静实时推给控制台。
 *
 * 前端拿到消息就 `router.refresh()`（见 live-refresh.tsx），因此日志与状态
 * 几乎瞬时可见，不必再靠 4 秒轮询。
 *
 * ⚠️ 心跳注释（`: ping`）不能省：中间的反向代理会掐掉长时间没有字节的连接。
 * ⚠️ 走的是全站门禁（`proxy.ts`），所以浏览器必须带会话 cookie；
 *    runner 不用这个端点，它是 pull 模型主动来问。
 */
import { subscribe } from "@/lib/events.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          closed = true;
        }
      };

      // 先打个招呼，让浏览器立刻确认连接已建立
      send(`retry: 3000\n\n`);

      const off = subscribe((kind) => send(`event: ${kind}\ndata: 1\n\n`));
      const ping = setInterval(() => send(`: ping\n\n`), 25_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        off();
        try {
          controller.close();
        } catch {
          // 已经关了就算了
        }
      };
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // 关掉 nginx 一类代理的缓冲，否则消息会被攒着一起发
      "x-accel-buffering": "no",
    },
  });
}
