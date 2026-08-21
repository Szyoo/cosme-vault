/** runner 调用控制面的 Bearer 令牌校验。 */
import { NextResponse } from "next/server";

export function checkRunnerAuth(req: Request): NextResponse | null {
  const token = process.env.RUNNER_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "服务端未配置 RUNNER_TOKEN" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  return null; // 通过
}
