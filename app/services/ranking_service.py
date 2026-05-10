from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models, schemas


def get_scorers_ranking(db: Session, pelada_id: int) -> schemas.RankingResponse:
    players = _build_ranking(db, pelada_id, "goals")
    return schemas.RankingResponse(ranking_type="scorers", players=players)


def get_assists_ranking(db: Session, pelada_id: int) -> schemas.RankingResponse:
    players = _build_ranking(db, pelada_id, "assists")
    return schemas.RankingResponse(ranking_type="assists", players=players)


def get_rankings_summary(db: Session, pelada_id: int) -> schemas.RankingsSummary:
    return schemas.RankingsSummary(
        scorers=get_scorers_ranking(db, pelada_id),
        assists=get_assists_ranking(db, pelada_id),
    )


def _build_ranking(db: Session, pelada_id: int, metric: str) -> list[schemas.RankingPlayer]:
    metric_column = models.MatchPlayer.goals if metric == "goals" else models.MatchPlayer.assists
    statement = (
        select(
            models.Player.id.label("player_id"),
            models.Player.name,
            models.Player.position,
            models.Player.rating,
            func.count(models.MatchPlayer.id).label("matches_played"),
            func.coalesce(func.sum(models.MatchPlayer.goals), 0).label("goals"),
            func.coalesce(func.sum(models.MatchPlayer.assists), 0).label("assists"),
        )
        .join(models.MatchPlayer, models.MatchPlayer.player_id == models.Player.id)
        .where(models.Player.pelada_id == pelada_id, models.MatchPlayer.pelada_id == pelada_id)
        .group_by(models.Player.id, models.Player.name, models.Player.position, models.Player.rating)
        .having(func.coalesce(func.sum(metric_column), 0) > 0)
    )

    rows = db.execute(statement).all()
    ranking = [
        schemas.RankingPlayer(
            player_id=row.player_id,
            name=row.name,
            position=row.position,
            rating=row.rating,
            matches_played=row.matches_played,
            goals=row.goals,
            assists=row.assists,
            goals_per_match=round(row.goals / row.matches_played, 2) if row.matches_played else 0,
            assists_per_match=round(row.assists / row.matches_played, 2) if row.matches_played else 0,
        )
        for row in rows
    ]

    return sorted(
        ranking,
        key=lambda player: (-getattr(player, metric), player.matches_played, player.name.lower()),
    )
