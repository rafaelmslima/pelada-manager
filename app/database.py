from __future__ import annotations

import os
from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./pelada_manager.db")


def _build_engine() -> Engine:
    if DATABASE_URL.startswith("sqlite"):
        return create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    return create_engine(DATABASE_URL)


engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def ensure_legacy_multitenant_columns(target_engine: Engine = engine) -> None:
    if not DATABASE_URL.startswith("sqlite"):
        return

    # Mapa coluna -> DDL para cada tabela (usado apenas em SQLite legado).
    required_by_table = {
        "peladas": {
            "location": "TEXT NOT NULL DEFAULT ''",
            "match_time": "TEXT NOT NULL DEFAULT '20:00'",
            "default_billing_type": "TEXT NOT NULL DEFAULT 'diarista'",
            "public_token": "TEXT",
        },
        "players": {
            "pelada_id": "INTEGER",
            "presence": "TEXT NOT NULL DEFAULT 'pending'",
        },
        "matches": {"pelada_id": "INTEGER"},
        "match_teams": {"pelada_id": "INTEGER"},
        "match_players": {"pelada_id": "INTEGER"},
    }

    with target_engine.begin() as connection:
        for table_name, columns in required_by_table.items():
            existing_columns = {
                row[1]
                for row in connection.execute(text(f"PRAGMA table_info({table_name})"))
            }
            if not existing_columns:
                # Tabela ainda nao existe (banco vazio) — create_all/alembic cuida disso.
                continue
            for column, ddl in columns.items():
                if column not in existing_columns:
                    connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column} {ddl}"))


# DDL idempotente para Postgres: garante colunas adicionadas depois do deploy inicial.
# Necessario quando o schema e criado via create_all (AUTO_CREATE_TABLES), que nao
# altera tabelas existentes ao surgirem colunas novas no modelo.
_POSTGRES_ENSURE_STATEMENTS = [
    "ALTER TABLE peladas ADD COLUMN IF NOT EXISTS location VARCHAR(160) NOT NULL DEFAULT ''",
    "ALTER TABLE peladas ADD COLUMN IF NOT EXISTS match_time VARCHAR(20) NOT NULL DEFAULT '20:00'",
    "ALTER TABLE peladas ADD COLUMN IF NOT EXISTS default_billing_type VARCHAR(20) NOT NULL DEFAULT 'diarista'",
    "ALTER TABLE peladas ADD COLUMN IF NOT EXISTS public_token VARCHAR(64)",
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_peladas_public_token ON peladas (public_token)",
    "ALTER TABLE players ADD COLUMN IF NOT EXISTS presence VARCHAR(20) NOT NULL DEFAULT 'pending'",
    "UPDATE players SET presence = 'confirmed' WHERE is_active AND presence = 'pending'",
]


def ensure_schema_columns(target_engine: Engine = engine) -> None:
    """Auto-corrige colunas faltantes no startup (idempotente). Cobre Postgres e SQLite."""
    dialect = target_engine.dialect.name
    if dialect == "sqlite":
        # A rotina PRAGMA ja cobre as colunas novas (inclui presence/public_token).
        ensure_legacy_multitenant_columns(target_engine)
        try:
            with target_engine.begin() as connection:
                connection.execute(
                    text("UPDATE players SET presence = 'confirmed' WHERE is_active = 1 AND presence = 'pending'")
                )
        except Exception:  # noqa: BLE001 - tabela pode nao existir ainda
            pass
        return
    if dialect != "postgresql":
        return
    for statement in _POSTGRES_ENSURE_STATEMENTS:
        # Cada comando em sua propria transacao: uma falha (ex.: tabela ainda inexistente
        # num banco vazio) nao aborta as demais.
        try:
            with target_engine.begin() as connection:
                connection.execute(text(statement))
        except Exception as error:  # noqa: BLE001 - startup defensivo
            print(f"[ensure_schema_columns] ignorado: {statement!r} -> {error}")


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
