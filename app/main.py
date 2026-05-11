from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.database import Base, engine, ensure_legacy_multitenant_columns
from app.routers import auth, matches, players, rankings, teams


Base.metadata.create_all(bind=engine)
ensure_legacy_multitenant_columns()

app = FastAPI(
    title="Pelada Manager",
    description="MVP para organizar jogadores e gerar times equilibrados.",
    version="0.2.0",
)

app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

app.include_router(auth.router)
app.include_router(players.router)
app.include_router(teams.router)
app.include_router(matches.router)
app.include_router(rankings.router)


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})
