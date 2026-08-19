#!/usr/bin/env bash
# 把 runner 装成 Mac mini 上的 LaunchAgent（开机自启、崩溃自动重启）。
#
# 前提：
#   1. 仓库已 clone 到本机，且已在仓库根跑过 npm install
#   2. 已装 Google Chrome（PLAYWRIGHT_CHANNEL=chrome 用真 Chrome，指纹更自然）
#   3. 仓库根的 .env 里配好 CONTROL_PLANE_URL 与 RUNNER_TOKEN
#   4. 已跑过 `npm run login` 建立 @COSME 会话（人工登录一次，见 README）
set -euo pipefail

RUNNER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$RUNNER_DIR/../.." && pwd)"
LABEL="xyz.szyyw.cosme-runner"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
NODE="$(command -v node)"

if [ -z "$NODE" ]; then
  echo "找不到 node，请先安装 Node 26+"; exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 26 ]; then
  echo "需要 Node 26+（当前 $(node -v)）：本项目靠原生 type-stripping 直接跑 TS"; exit 1
fi
if [ ! -f "$REPO/.env" ]; then
  echo "缺少 $REPO/.env —— 请先照 .env.example 配好"; exit 1
fi

mkdir -p "$RUNNER_DIR/logs" "$HOME/Library/LaunchAgents"

echo "→ 生成 $PLIST"
sed -e "s|__NODE__|$NODE|g" \
    -e "s|__RUNNER_DIR__|$RUNNER_DIR|g" \
    -e "s|__REPO__|$REPO|g" \
    "$RUNNER_DIR/launchd/$LABEL.plist" > "$PLIST"

echo "→ 重新加载 LaunchAgent"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

sleep 3
if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  echo "✅ 已安装并启动。日志：tail -f $RUNNER_DIR/logs/runner.log"
else
  echo "⚠️ 安装完成但服务未在运行，看错误日志：$RUNNER_DIR/logs/runner.error.log"
fi

cat <<'TIP'

后续操作：
  停止   launchctl bootout gui/$(id -u)/xyz.szyyw.cosme-runner
  重启   再跑一次 ./install.sh
  日志   tail -f logs/runner.log
  会话   npm run login -- --check   # 查 @COSME 会话是否还有效
TIP
