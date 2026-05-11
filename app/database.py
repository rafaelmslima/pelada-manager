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

    required_by_table = {
        "peladas": ["location", "match_time", "default_billing_type"],
        "players": ["pelada_id"],
        "matches": ["pelada_id"],
        "match_teams": ["pelada_id"],
        "match_players": ["pelada_id"],
    }

    with target_engine.begin() as connection:
        for table_name, required_columns in required_by_table.items():
            existing_columns = {
                row[1]
                for row in connection.execute(text(f"PRAGMA table_info({table_name})"))
            }
            for column in required_columns:
                if column not in existing_columns:
                    if table_name == "peladas":
                        defaults = {
                            "location": "TEXT NOT NULL DEFAULT ''",
                            "match_time": "TEXT NOT NULL DEFAULT '20:00'",
                            "default_billing_type": "TEXT NOT NULL DEFAULT 'diarista'",
                        }
                        connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column} {defaults[column]}"))
                    else:
                        connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column} INTEGER"))


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
