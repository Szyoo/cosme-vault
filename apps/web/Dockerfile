# 控制面镜像（Next 16 standalone）。从**仓库根**作为 build context 构建，
# 因为要带上 packages/* 这些 workspace 包。
#
# 比 ledger 简单：SQLite 不需要额外 DB 容器，也没有 Prisma 那套 CLI/adapter 的坑。
FROM node:26-alpine AS deps
WORKDIR /app
# 只拷依赖清单，让这层能被缓存
COPY package.json package-lock.json ./
COPY packages/contract/package.json ./packages/contract/
COPY packages/core/package.json ./packages/core/
COPY apps/web/package.json ./apps/web/
COPY apps/runner/package.json ./apps/runner/
# better-sqlite3 13 有 Node 26 预编译包；万一走到源码编译，这些是 node-gyp 的前置
RUN apk add --no-cache python3 make g++ && npm ci

FROM node:26-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
# 构建期不需要真密钥，但 lib/crypto.ts 在缺失时会抛——给占位值绕过构建期求值
ENV SESSION_SECRET="0000000000000000000000000000000000000000000000000000000000000000"
ENV CREDENTIAL_KEY="0000000000000000000000000000000000000000000000000000000000000000"
RUN npm run build --workspace @cosme/web

FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next standalone 会按 HOSTNAME 绑定；容器有双网卡时可能绑到内网侧，必须显式全绑
ENV HOSTNAME=0.0.0.0
ENV DATABASE_PATH=/data/cosme.db

# standalone 产物。⚠️ monorepo 下它在 **apps/web/.next/standalone**（不是仓库根的 .next），
# 且内部保留 workspace 结构，入口为 apps/web/server.js（已实测确认）。
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
# 迁移文件与 drizzle 配置：容器启动时跑迁移
COPY --from=builder /app/apps/web/drizzle ./apps/web/drizzle
COPY --from=builder /app/apps/web/drizzle.config.ts ./apps/web/drizzle.config.ts
COPY --from=builder /app/apps/web/src/db ./apps/web/src/db
# drizzle-kit 与 better-sqlite3 独立装一份：standalone 会裁剪掉只在启动脚本里用到的包
RUN mkdir /migrate && cd /migrate && npm init -y >/dev/null 2>&1 \
 && npm install drizzle-kit@0.31.10 drizzle-orm@0.45.2 better-sqlite3@13.0.3 >/dev/null 2>&1

COPY apps/web/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

VOLUME ["/data"]
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
