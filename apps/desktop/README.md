# apps/desktop —— 桌面应用槽位（预留，暂未开工）

本目录是**为将来的桌面客户端预留的位置**，当前为空壳，不参与构建。

## 为什么是空的

v6 已转向 Web 架构（控制面部署 VPS + runner 执行器），桌面路线推迟。
但前后端分离的设计**刻意保证了桌面客户端随时可加**：它只需作为
`packages/contract` 的又一个消费方，复用同一套 HTTP API，无需改动后端。

## 第 5 代的桌面实现在哪

完整的 Vue 3 + Electron 实现保存在 git 标签 `v5-electron-desktop` 里，
包含 UI 原子组件（AuroraBackground / MorphingTabs / SparklesText / RippleButton / Dock*）
与三栏布局（LeftSection 奖品+选项 / CenterSection 控制 / RightSection 日志）。

取回参考：

```bash
# 看某个组件
git show v5-electron-desktop:cosme-x/src/components/MorphingTabs.vue

# 整套捞到本目录
git checkout v5-electron-desktop -- cosme-x && mv cosme-x apps/desktop/legacy-vue
```

⚠️ 取回时注意：那批代码有已知缺陷（`Dock.vue` 引用了不存在的 `./types`、
残留 `this.$store` 但项目无 store、`vite.config.js` 的 `outDir` 与 `publicDir` 冲突），
且是 Vue，而现行前端是 React + `@szyyw/design`。**建议仅作视觉与布局参考，不要直接复用代码。**

## 开工时要做的

1. 本目录放 `package.json`（届时会被根 `workspaces: ["apps/*"]` 自动纳入）
2. 依赖 `@cosme/contract` 复用协议类型
3. 通过 HTTP 调 `apps/web` 的 API；**不要**直连数据库或重写业务逻辑
