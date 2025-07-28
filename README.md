# Cosme Vault

该仓库包含桌面应用前后端代码，目录结构如下：

- `cosme-x/`：Vue 3 + Electron 前端项目。
- `cosme-y/`：FastAPI 后端项目（代码位于 cosme-y/app），监听 8888 端口。

## 启动前端

```bash
cd cosme-x
npm install
npm run dev:all
```

## 启动后端

```bash
cd cosme-y
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8888
```

前端会通过 `http://localhost:8888` 与后端通讯，并使用 `ws://localhost:8888/ws` 建立 WebSocket 连接。
