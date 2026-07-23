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
        "users": {"active_pelada_id": "INTEGER", "plan": "TEXT NOT NULL DEFAULT 'free'"},
        "peladas": {
            "location": "TEXT NOT NULL DEFAULT ''",
            "match_time": "TEXT NOT NULL DEFAULT '20:00'",
            "default_billing_type": "TEXT NOT NULL DEFAULT 'diarista'",
            "public_token": "TEXT",
            "invite_code": "TEXT",
            "daily_fee": "REAL NOT NULL DEFAULT 0",
            "monthly_fee": "REAL NOT NULL DEFAULT 0",
            "monthly_due_day": "INTEGER NOT NULL DEFAULT 10",
        },
        "players": {
            "pelada_id": "INTEGER",
            "presence": "TEXT NOT NULL DEFAULT 'pending'",
            "paid_month": "TEXT",
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
    "ALTER TABLE peladas ADD COLUMN IF NOT EXISTS daily_fee DOUBLE PRECISION NOT NULL DEFAULT 0",
    "ALTER TABLE peladas ADD COLUMN IF NOT EXISTS monthly_fee DOUBLE PRECISION NOT NULL DEFAULT 0",
    "ALTER TABLE peladas ADD COLUMN IF NOT EXISTS monthly_due_day INTEGER NOT NULL DEFAULT 10",
    "ALTER TABLE players ADD COLUMN IF NOT EXISTS paid_month VARCHAR(7)",
    "ALTER TABLE peladas ADD COLUMN IF NOT EXISTS public_token VARCHAR(64)",
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_peladas_public_token ON peladas (public_token)",
    "ALTER TABLE players ADD COLUMN IF NOT EXISTS presence VARCHAR(20) NOT NULL DEFAULT 'pending'",
    "UPDATE players SET presence = 'confirmed' WHERE is_active AND presence = 'pending'",
    (
        "CREATE TABLE IF NOT EXISTS device_tokens ("
        " id SERIAL PRIMARY KEY,"
        " user_id INTEGER NOT NULL REFERENCES users(id),"
        " token VARCHAR(255) NOT NULL UNIQUE,"
        " platform VARCHAR(20) NOT NULL DEFAULT '',"
        " created_at TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc')"
        ")"
    ),
    "CREATE INDEX IF NOT EXISTS ix_device_tokens_user_id ON device_tokens (user_id)",
    (
        "CREATE TABLE IF NOT EXISTS player_ratings ("
        " id SERIAL PRIMARY KEY,"
        " pelada_id INTEGER NOT NULL REFERENCES peladas(id),"
        " match_id INTEGER NOT NULL REFERENCES matches(id),"
        " player_id INTEGER NOT NULL REFERENCES players(id),"
        " score DOUBLE PRECISION NOT NULL,"
        " created_at TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),"
        " CONSTRAINT uq_player_rating_match_player UNIQUE (match_id, player_id)"
        ")"
    ),
    "CREATE INDEX IF NOT EXISTS ix_player_ratings_player_id ON player_ratings (player_id)",
    (
        "CREATE TABLE IF NOT EXISTS finance_entries ("
        " id SERIAL PRIMARY KEY,"
        " pelada_id INTEGER NOT NULL REFERENCES peladas(id),"
        " kind VARCHAR(10) NOT NULL,"
        " amount DOUBLE PRECISION NOT NULL,"
        " description VARCHAR(160) NOT NULL DEFAULT '',"
        " player_id INTEGER REFERENCES players(id),"
        " created_at TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc')"
        ")"
    ),
    "CREATE INDEX IF NOT EXISTS ix_finance_entries_pelada_id ON finance_entries (pelada_id)",
    # Freemium
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'free'",
    # Multi-pelada
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS active_pelada_id INTEGER",
    "ALTER TABLE peladas ADD COLUMN IF NOT EXISTS invite_code VARCHAR(20)",
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_peladas_invite_code ON peladas (invite_code)",
    # Permite um usuario ter varias peladas (remove o unique antigo do dono).
    "ALTER TABLE peladas DROP CONSTRAINT IF EXISTS peladas_owner_user_id_key",
    (
        "CREATE TABLE IF NOT EXISTS pelada_members ("
        " id SERIAL PRIMARY KEY,"
        " user_id INTEGER NOT NULL REFERENCES users(id),"
        " pelada_id INTEGER NOT NULL REFERENCES peladas(id),"
        " role VARCHAR(20) NOT NULL DEFAULT 'member',"
        " created_at TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),"
        " CONSTRAINT uq_pelada_member UNIQUE (user_id, pelada_id)"
        ")"
    ),
    "CREATE INDEX IF NOT EXISTS ix_pelada_members_user_id ON pelada_members (user_id)",
    # Backfill: dono vira membro 'owner' e ganha pelada ativa.
    (
        "INSERT INTO pelada_members (user_id, pelada_id, role, created_at)"
        " SELECT owner_user_id, id, 'owner', (now() AT TIME ZONE 'utc') FROM peladas p"
        " WHERE NOT EXISTS (SELECT 1 FROM pelada_members m WHERE m.pelada_id = p.id AND m.user_id = p.owner_user_id)"
    ),
    (
        "UPDATE users SET active_pelada_id ="
        " (SELECT p.id FROM peladas p WHERE p.owner_user_id = users.id ORDER BY p.id LIMIT 1)"
        " WHERE active_pelada_id IS NULL"
    ),
    # Confrontos ao vivo (rodizio)
    (
        "CREATE TABLE IF NOT EXISTS match_rounds ("
        " id SERIAL PRIMARY KEY,"
        " pelada_id INTEGER NOT NULL REFERENCES peladas(id),"
        " match_id INTEGER NOT NULL REFERENCES matches(id),"
        " team_a_id INTEGER NOT NULL REFERENCES match_teams(id),"
        " team_b_id INTEGER NOT NULL REFERENCES match_teams(id),"
        " goals_a INTEGER NOT NULL DEFAULT 0,"
        " goals_b INTEGER NOT NULL DEFAULT 0,"
        " duration_seconds INTEGER NOT NULL DEFAULT 0,"
        " created_at TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc')"
        ")"
    ),
    "CREATE INDEX IF NOT EXISTS ix_match_rounds_match_id ON match_rounds (match_id)",
    (
        "CREATE TABLE IF NOT EXISTS round_player_stats ("
        " id SERIAL PRIMARY KEY,"
        " pelada_id INTEGER NOT NULL REFERENCES peladas(id),"
        " round_id INTEGER NOT NULL REFERENCES match_rounds(id),"
        " player_id INTEGER NOT NULL REFERENCES players(id),"
        " goals INTEGER NOT NULL DEFAULT 0,"
        " assists INTEGER NOT NULL DEFAULT 0"
        ")"
    ),
    "CREATE INDEX IF NOT EXISTS ix_round_player_stats_round_id ON round_player_stats (round_id)",
]

_SQLITE_ENSURE_STATEMENTS = [
    (
        "CREATE TABLE IF NOT EXISTS device_tokens ("
        " id INTEGER PRIMARY KEY,"
        " user_id INTEGER NOT NULL,"
        " token VARCHAR(255) NOT NULL UNIQUE,"
        " platform VARCHAR(20) NOT NULL DEFAULT '',"
        " created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"
        ")"
    ),
    (
        "CREATE TABLE IF NOT EXISTS player_ratings ("
        " id INTEGER PRIMARY KEY,"
        " pelada_id INTEGER NOT NULL,"
        " match_id INTEGER NOT NULL,"
        " player_id INTEGER NOT NULL,"
        " score REAL NOT NULL,"
        " created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,"
        " UNIQUE (match_id, player_id)"
        ")"
    ),
    (
        "CREATE TABLE IF NOT EXISTS finance_entries ("
        " id INTEGER PRIMARY KEY,"
        " pelada_id INTEGER NOT NULL,"
        " kind VARCHAR(10) NOT NULL,"
        " amount REAL NOT NULL,"
        " description VARCHAR(160) NOT NULL DEFAULT '',"
        " player_id INTEGER,"
        " created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"
        ")"
    ),
    (
        "CREATE TABLE IF NOT EXISTS pelada_members ("
        " id INTEGER PRIMARY KEY,"
        " user_id INTEGER NOT NULL,"
        " pelada_id INTEGER NOT NULL,"
        " role VARCHAR(20) NOT NULL DEFAULT 'member',"
        " created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,"
        " UNIQUE (user_id, pelada_id)"
        ")"
    ),
    (
        "CREATE TABLE IF NOT EXISTS match_rounds ("
        " id INTEGER PRIMARY KEY,"
        " pelada_id INTEGER NOT NULL,"
        " match_id INTEGER NOT NULL,"
        " team_a_id INTEGER NOT NULL,"
        " team_b_id INTEGER NOT NULL,"
        " goals_a INTEGER NOT NULL DEFAULT 0,"
        " goals_b INTEGER NOT NULL DEFAULT 0,"
        " duration_seconds INTEGER NOT NULL DEFAULT 0,"
        " created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"
        ")"
    ),
    (
        "CREATE TABLE IF NOT EXISTS round_player_stats ("
        " id INTEGER PRIMARY KEY,"
        " pelada_id INTEGER NOT NULL,"
        " round_id INTEGER NOT NULL,"
        " player_id INTEGER NOT NULL,"
        " goals INTEGER NOT NULL DEFAULT 0,"
        " assists INTEGER NOT NULL DEFAULT 0"
        ")"
    ),
]


def ensure_schema_columns(target_engine: Engine = engine) -> None:
    """Auto-corrige colunas faltantes no startup (idempotente). Cobre Postgres e SQLite."""
    dialect = target_engine.dialect.name
    if dialect == "sqlite":
        # A rotina PRAGMA ja cobre as colunas novas (inclui presence/public_token).
        ensure_legacy_multitenant_columns(target_engine)
        for statement in _SQLITE_ENSURE_STATEMENTS:
            try:
                with target_engine.begin() as connection:
                    connection.execute(text(statement))
            except Exception as error:  # noqa: BLE001 - startup defensivo
                print(f"[ensure_schema_columns] ignorado: {statement!r} -> {error}")
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
