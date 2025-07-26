from fastapi import FastAPI, WebSocket, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import subprocess

from . import database, models, playwright_helper

app = FastAPI(title="Cosme API")


@app.on_event("startup")
def on_startup():
    # Create tables if they don't exist
    database.Base.metadata.create_all(bind=database.engine)

@app.get("/prizes")
def list_prizes(db: Session = Depends(database.get_db)):
    prizes = db.query(models.Prize).all()
    # 如果数据库为空，返回示例数据
    if not prizes:
        prizes = [models.Prize(id=1, text="奖品A"), models.Prize(id=2, text="奖品B")]
    return JSONResponse(content=[{"id": p.id, "text": p.text} for p in prizes])

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data = await ws.receive_json()
            await ws.send_json({"echo": data})
    except Exception:
        await ws.close()

@app.get("/get-chromedriver-version")
async def get_chromedriver_version():
    try:
        result = subprocess.run(
            ["chromedriver", "--version"],
            capture_output=True,
            text=True,
            check=True,
        )
        version = result.stdout.strip()
    except Exception as exc:
        version = str(exc)
    return {"chromedriver_version": version}


@app.get("/page-title")
async def page_title(url: str = Query(..., description="要抓取的页面URL")):
    title = await playwright_helper.fetch_title(url)
    return {"title": title}
