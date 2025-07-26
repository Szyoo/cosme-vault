# cosme-y Backend

基于 **FastAPI** 的轻量级后端，提供前端所需的 REST API 与 WebSocket 服务。

## 技术栈

- Python 3.11+
- FastAPI
- Uvicorn
- SQLAlchemy (SQLite)
- Playwright

## 快速开始

1. (可选) 创建并激活虚拟环境： `python -m venv venv && source venv/bin/activate`
2. 安装依赖： `pip install -r requirements.txt`
3. 启动开发服务器：
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8888
   ```
4. 前端将通过 `http://localhost:8888` 与此后端交互，并通过 `ws://localhost:8888/ws` 建立 WebSocket 连接。

## 可用接口

- `GET /prizes`：返回简单的奖品列表。
- `GET /get-chromedriver-version`：尝试获取 `chromedriver` 版本。
- `GET /page-title?url=`：使用 Playwright 获取指定页面标题。
- `WebSocket /ws`：简单的回显示例，可根据需求扩展。
