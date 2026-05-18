import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine, ensure_legacy_multitenant_columns
from app.routers import auth, matches, players, rankings, teams


def initialize_database_from_env() -> None:
    if os.getenv("AUTO_CREATE_TABLES", "false").lower() == "true":
        Base.metadata.create_all(bind=engine)

    if os.getenv("AUTO_PATCH_LEGACY_SQLITE", "false").lower() == "true":
        ensure_legacy_multitenant_columns()


initialize_database_from_env()

app = FastAPI(
    title="Pelada Manager",
    description="MVP para organizar jogadores e gerar times equilibrados.",
    version="0.2.0",
)

app.mount("/static", StaticFiles(directory="app/static"), name="static")

app.include_router(auth.router)
app.include_router(players.router)
app.include_router(teams.router)
app.include_router(matches.router)
app.include_router(rankings.router)

REACT_INDEX = Path("app/static/react/index.html")
SERVICE_WORKER = Path("app/static/service-worker.js")


@app.get("/service-worker.js", include_in_schema=False)
def service_worker():
    return FileResponse(SERVICE_WORKER, media_type="application/javascript")


@app.get("/", include_in_schema=False)
@app.get("/{full_path:path}", include_in_schema=False)
def react_app(full_path: str = ""):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")
    if REACT_INDEX.exists():
        return FileResponse(REACT_INDEX)
    return FileResponse("app/templates/index.html")
