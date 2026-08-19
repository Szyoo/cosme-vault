#!/bin/sh
# 容器启动：先跑数据库迁移，再拉起 Next standalone。
set -e

echo "[entrypoint] 数据目录 $(dirname "$DATABASE_PATH")"
mkdir -p "$(dirname "$DATABASE_PATH")"

# drizzle-kit 直连 DB，不经 src/db/index.ts；用独立装的那份依赖树
echo "[entrypoint] 执行数据库迁移…"
cd /app/apps/web
NODE_PATH=/migrate/node_modules /migrate/node_modules/.bin/drizzle-kit migrate \
  || { echo "[entrypoint] 迁移失败"; exit 1; }
cd /app

echo "[entrypoint] 启动控制面…"
exec node apps/web/server.js
