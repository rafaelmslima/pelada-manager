from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from datetime import date
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app import models


DEFAULT_SOURCE = "pelada_manager.db"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Migra dados do SQLite local para a pelada de um admin no Postgres.",
    )
    parser.add_argument("--source", default=DEFAULT_SOURCE, help="Caminho do SQLite local.")
    parser.add_argument("--target-url", default=os.getenv("DATABASE_URL"), help="DATABASE_URL do Postgres.")
    parser.add_argument("--admin-email", required=True, help="Email do admin dono da pelada destino.")
    parser.add_argument("--include-history", action="store_true", help="Tambem migra partidas, times e estatisticas.")
    parser.add_argument("--dry-run", action="store_true", help="Mostra o que seria migrado sem gravar no Postgres.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source_path = Path(args.source)
    if not source_path.exists():
        raise SystemExit(f"SQLite local nao encontrado: {source_path}")
    if not args.target_url:
        raise SystemExit("Informe --target-url ou defina DATABASE_URL com a URL do Postgres.")
    if args.target_url.startswith("sqlite"):
        raise SystemExit("O target precisa ser PostgreSQL, nao SQLite.")

    sqlite = sqlite3.connect(source_path)
    sqlite.row_factory = sqlite3.Row
    target_engine = create_engine(args.target_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=target_engine)

    with SessionLocal() as db:
        user = db.scalars(select(models.User).where(models.User.email == args.admin_email.lower())).first()
        if user is None or user.pelada is None:
            raise SystemExit(f"Usuario/pelada destino nao encontrado: {args.admin_email}")

        players = list(sqlite.execute("SELECT * FROM players ORDER BY id"))
        matches = list(sqlite.execute("SELECT * FROM matches ORDER BY id")) if args.include_history else []
        teams = list(sqlite.execute("SELECT * FROM match_teams ORDER BY id")) if args.include_history else []
        entries = list(sqlite.execute("SELECT * FROM match_players ORDER BY id")) if args.include_history else []

        print(f"Destino: {user.email} / pelada_id={user.pelada.id} / {user.pelada.name}")
        print(f"Jogadores locais: {len(players)}")
        if args.include_history:
            print(f"Historico local: {len(matches)} partidas, {len(teams)} times, {len(entries)} participacoes")
        if args.dry_run:
            print("Dry-run: nada sera gravado.")
            return

        player_id_map = migrate_players(db, user.pelada.id, players)
        if args.include_history:
            migrate_history(db, user.pelada.id, matches, teams, entries, player_id_map)

        db.commit()

        print("Migracao concluida.")
        print(f"Jogadores migrados/encontrados: {len(player_id_map)}")


def migrate_players(db: Session, pelada_id: int, rows: list[sqlite3.Row]) -> dict[int, int]:
    player_id_map: dict[int, int] = {}
    existing_players = {
        normalize_key(player.name): player
        for player in db.scalars(select(models.Player).where(models.Player.pelada_id == pelada_id)).all()
    }

    for row in rows:
        key = normalize_key(row["name"])
        player = existing_players.get(key)
        if player is None:
            player = models.Player(
                pelada_id=pelada_id,
                name=row["name"],
                position=row["position"],
                rating=float(row["rating"]),
                is_active=bool(row["is_active"]),
                billing_type=row["billing_type"] if "billing_type" in row.keys() else "diarista",
                has_paid=bool(row["has_paid"]) if "has_paid" in row.keys() else False,
                whatsapp=row["whatsapp"] if "whatsapp" in row.keys() else "",
            )
            db.add(player)
            db.flush()
            existing_players[key] = player
        player_id_map[int(row["id"])] = player.id

    return player_id_map


def migrate_history(
    db: Session,
    pelada_id: int,
    matches: list[sqlite3.Row],
    teams: list[sqlite3.Row],
    entries: list[sqlite3.Row],
    player_id_map: dict[int, int],
) -> None:
    match_id_map: dict[int, int] = {}
    team_id_map: dict[int, int] = {}
    existing_titles = {
        (match.date.isoformat(), match.title)
        for match in db.scalars(select(models.Match).where(models.Match.pelada_id == pelada_id)).all()
    }

    for row in matches:
        key = (row["date"], row["title"])
        if key in existing_titles:
            continue
        match = models.Match(
            pelada_id=pelada_id,
            date=date.fromisoformat(row["date"]),
            title=row["title"],
        )
        db.add(match)
        db.flush()
        match_id_map[int(row["id"])] = match.id

    for row in teams:
        old_match_id = int(row["match_id"])
        if old_match_id not in match_id_map:
            continue
        team = models.MatchTeam(
            pelada_id=pelada_id,
            match_id=match_id_map[old_match_id],
            name=row["name"],
            total_rating=float(row["total_rating"]),
            is_team_of_the_week=bool(row["is_team_of_the_week"]),
        )
        db.add(team)
        db.flush()
        team_id_map[int(row["id"])] = team.id

    for row in entries:
        old_match_id = int(row["match_id"])
        old_team_id = int(row["team_id"])
        old_player_id = int(row["player_id"])
        if old_match_id not in match_id_map or old_team_id not in team_id_map or old_player_id not in player_id_map:
            continue
        db.add(
            models.MatchPlayer(
                pelada_id=pelada_id,
                match_id=match_id_map[old_match_id],
                team_id=team_id_map[old_team_id],
                player_id=player_id_map[old_player_id],
                goals=int(row["goals"]),
                assists=int(row["assists"]),
                was_in_team_of_the_week=bool(row["was_in_team_of_the_week"]),
            )
        )


def normalize_key(value: str) -> str:
    return " ".join(value.strip().lower().split())


if __name__ == "__main__":
    main()
