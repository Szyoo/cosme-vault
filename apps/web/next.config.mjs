/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker 生产用 standalone 产物（compose 部署）
  output: "standalone",
  // monorepo：允许编译 workspace 内的共享包源码
  transpilePackages: ["@cosme/contract", "@cosme/core"],
  // better-sqlite3 是原生模块，保持外部化不打包
  serverExternalPackages: ["better-sqlite3"],
  /**
   * 允许从局域网/tailnet 地址访问 dev server 的静态资源。
   *
   * Next 16 默认只允许 localhost 取 /_next/* 资源，从别的 host 访问会被拦，
   * 于是页面 JS 根本不加载——表现是「登录点了没反应」，而且表单会退化成
   * 原生 GET 提交，把密码暴露到 URL 里（实测踩过）。
   * 生产走 Caddy 反代，不涉及此项。
   *
   * 需要的 host 用环境变量 NEXT_DEV_ORIGINS 配置（逗号分隔，如 "dev-host.local,dev-host.example.net"），默认空。
   */
  allowedDevOrigins: (process.env.NEXT_DEV_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};

export default nextConfig;
