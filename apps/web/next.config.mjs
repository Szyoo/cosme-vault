/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker 生产用 standalone 产物（compose 部署，参考 finance-ledger）
  output: "standalone",
  // monorepo：允许编译 workspace 内的共享包源码
  transpilePackages: ["@cosme/contract", "@cosme/core"],
  // better-sqlite3 是原生模块，保持外部化不打包
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
