# Cosme Vault

@cosme 奖品活动的抽奖辅助工具。本分支保存的是早期的桌面版：Vue 3 + Electron 前端和 FastAPI 后端。

> 当前版本（Web 控制面 + Playwright 执行器）在 [`feat/monorepo-v6`](https://github.com/Szyoo/cosme-vault/tree/feat/monorepo-v6) 分支开发，功能、安装和接口说明见该分支的 README。

## 功能概览

- `cosme-x/`：桌面前端（Vue 3 + Vite + Tailwind CSS，Electron 外壳），有抽奖、记录、设置三个页面。
- `app/`：后端（FastAPI + SQLAlchemy + SQLite），提供奖品列表、WebSocket 通道和基于 Playwright 的页面抓取。

## 安装

需要 Python 3、Node.js 和 npm。

```bash
# 后端
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium

# 前端
cd cosme-x
npm install
```

## 运行

```bash
# 后端：监听 8888 端口，首次启动时在当前目录创建 cosme.db
./start.sh            # 等同于 uvicorn app.main:app --reload --host 0.0.0.0 --port 8888

# 前端：同时启动 Vite 开发服务器（5173）和 Electron 窗口
cd cosme-x
npm run dev:all
```

前端通过 `http://localhost:8888` 访问后端。

## 接口说明

| 端点 | 说明 |
| --- | --- |
| `GET /prizes` | 奖品列表 `[{ id, text }]`；数据库为空时返回示例数据 |
| `WS /ws` | WebSocket 通道，目前原样回显收到的 JSON |
| `GET /page-title?url=<地址>` | 用 Playwright 打开页面并返回标题 |
| `GET /get-chromedriver-version` | 返回本机 `chromedriver --version` 的输出 |
