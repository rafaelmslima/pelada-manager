import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.database import (
    Base,
    engine,
    ensure_legacy_multitenant_columns,
    ensure_schema_columns,
)
from app.routers import (
    auth,
    billing,
    devices,
    finance,
    matches,
    peladas,
    players,
    public,
    rankings,
    teams,
)


def initialize_database_from_env() -> None:
    if os.getenv("AUTO_CREATE_TABLES", "false").lower() == "true":
        Base.metadata.create_all(bind=engine)

    if os.getenv("AUTO_PATCH_LEGACY_SQLITE", "false").lower() == "true":
        ensure_legacy_multitenant_columns()

    # Auto-corrige colunas adicionadas apos o deploy inicial (idempotente, Postgres+SQLite).
    # Roda sempre: em banco ja criado, apenas adiciona o que falta; caso contrario, e no-op.
    ensure_schema_columns()


initialize_database_from_env()

app = FastAPI(
    title="Pelada Manager",
    description="MVP para organizar jogadores e gerar times equilibrados.",
    version="0.2.0",
)

# CORS para o app mobile (Expo) consumir a API de outra origem.
# Apps nativos nao aplicam CORS, mas isso habilita tambem o Expo Web e e inofensivo
# para a web same-origin (que continua usando cookie). O mobile usa Bearer token,
# entao nao precisamos de credenciais cross-origin.
_cors_origins_env = os.getenv("CORS_ALLOW_ORIGINS", "*").strip()
_cors_origins = [origin.strip() for origin in _cors_origins_env.split(",") if origin.strip()] or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="app/static"), name="static")

app.include_router(auth.router)
app.include_router(players.router)
app.include_router(teams.router)
app.include_router(matches.router)
app.include_router(rankings.router)
app.include_router(peladas.router)
app.include_router(public.router)
app.include_router(devices.router)
app.include_router(finance.router)
app.include_router(billing.router)

REACT_INDEX = Path("app/static/react/index.html")
SERVICE_WORKER = Path("app/static/service-worker.js")
CONFIRMATION_PAGE = Path("app/static/confirmation.html")


@app.get("/service-worker.js", include_in_schema=False)
def service_worker():
    return FileResponse(SERVICE_WORKER, media_type="application/javascript")


@app.get("/confirmar/{token}", include_in_schema=False)
def confirmation_page(token: str):
    # Pagina publica autocontida; o token e lido do proprio path pelo JS.
    return FileResponse(CONFIRMATION_PAGE, media_type="text/html")


@app.get("/", include_in_schema=False)
@app.get("/{full_path:path}", include_in_schema=False)
def react_app(full_path: str = ""):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")
    if REACT_INDEX.exists():
        return FileResponse(REACT_INDEX)
    return FileResponse("app/templates/index.html")
