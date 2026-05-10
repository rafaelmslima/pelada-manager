# Pelada Manager

Aplicacao multiusuario para organizar peladas com login, isolamento por conta (multi-tenant), historico, rankings e PWA instalavel.

## Stack
- FastAPI + SQLAlchemy
- PostgreSQL via `DATABASE_URL` (Railway)
- SQLite como fallback local
- Alembic para migracoes
- Frontend em HTML/CSS/JS

## Setup
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Rodar local
```bash
uvicorn app.main:app --reload
```

## Migracoes
```bash
alembic upgrade head
```

## Railway
- Definir `DATABASE_URL` no projeto.
- Comando web: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- `Procfile` incluido.

## Autenticacao
- Rotas publicas: `/api/auth/register`, `/api/auth/login`
- Sessao por cookie HTTP-only
- Rotas `/api/*` protegidas por sessao

## Testes
```bash
python -m unittest discover -s tests -v
```
