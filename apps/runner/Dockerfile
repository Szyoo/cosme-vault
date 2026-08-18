# runner 容器：VPS 无头部署形态。被风控则改跑 Mac mini（launchd，不用此镜像）。
# 用 Playwright 官方镜像，自带 Chromium 与系统依赖，省去 playwright install-deps。
FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app
ENV NODE_ENV=production

# 需要 Node 26（官方镜像基于较旧 Node，这里覆盖安装）
RUN apt-get update && apt-get install -y curl ca-certificates \
  && curl -fsSL https://deb.nodesource.com/setup_26.x | bash - \
  && apt-get install -y nodejs \
  && rm -rf /var/lib/apt/lists/*

# monorepo：从仓库根 context 构建
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY apps/runner ./apps/runner
RUN npm ci --omit=dev --workspace @cosme/runner --include-workspace-root || npm install --omit=dev

WORKDIR /app/apps/runner
CMD ["node", "src/index.ts"]
