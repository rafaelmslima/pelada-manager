import secrets

from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app import models, schemas


PRESENCE_CONFIRMED = "confirmed"
PRESENCE_DECLINED = "declined"
PRESENCE_PENDING = "pending"


def get_players(db: Session, pelada_id: int) -> list[models.Player]:
    statement = (
        select(models.Player)
        .where(models.Player.pelada_id == pelada_id)
        .order_by(models.Player.name.asc())
    )
    return list(db.scalars(statement).all())


def get_active_players(db: Session, pelada_id: int) -> list[models.Player]:
    statement = (
        select(models.Player)
        .where(models.Player.pelada_id == pelada_id, models.Player.is_active.is_(True))
        .order_by(models.Player.position.asc(), models.Player.rating.desc())
    )
    return list(db.scalars(statement).all())


def get_player(db: Session, player_id: int, pelada_id: int) -> models.Player | None:
    return db.scalars(
        select(models.Player).where(models.Player.id == player_id, models.Player.pelada_id == pelada_id)
    ).first()


def create_player(db: Session, player_data: schemas.PlayerCreate, pelada_id: int) -> models.Player:
    data = player_data.model_dump()
    presence = PRESENCE_CONFIRMED if data.get("is_active") else PRESENCE_PENDING
    player = models.Player(pelada_id=pelada_id, presence=presence, **data)
    db.add(player)
    db.commit()
    db.refresh(player)
    return player


def update_player(
    db: Session,
    player: models.Player,
    player_data: schemas.PlayerUpdate,
) -> models.Player:
    for field, value in player_data.model_dump().items():
        setattr(player, field, value)
    # Mantem presence coerente com is_active: confirmar seta "confirmed";
    # desmarcar so rebaixa "confirmed" para "pending" (preserva "declined").
    if player.is_active:
        player.presence = PRESENCE_CONFIRMED
    elif player.presence == PRESENCE_CONFIRMED:
        player.presence = PRESENCE_PENDING
    db.commit()
    db.refresh(player)
    return player


def delete_player(db: Session, player: models.Player, pelada_id: int) -> None:
    has_history = db.scalars(
        select(models.MatchPlayer.id)
        .where(models.MatchPlayer.player_id == player.id, models.MatchPlayer.pelada_id == pelada_id)
        .limit(1)
    ).first()
    if has_history:
        raise ValueError("Nao e possivel excluir jogador com historico de peladas.")

    db.delete(player)
    db.commit()


def toggle_player_active(db: Session, player: models.Player) -> models.Player:
    player.is_active = not player.is_active
    player.presence = PRESENCE_CONFIRMED if player.is_active else PRESENCE_PENDING
    db.commit()
    db.refresh(player)
    return player


def deactivate_all_players(db: Session, pelada_id: int) -> list[models.Player]:
    # Reseta a presenca de todos (novo dia de pelada): inativa e volta para "pending".
    db.execute(
        update(models.Player)
        .where(models.Player.pelada_id == pelada_id)
        .values(is_active=False, presence=PRESENCE_PENDING)
    )
    db.commit()
    return get_players(db, pelada_id)


# --- Confirmacao de presenca (link publico) ---

def get_pelada_by_token(db: Session, token: str) -> models.Pelada | None:
    if not token:
        return None
    return db.scalars(select(models.Pelada).where(models.Pelada.public_token == token)).first()


def _generate_unique_token(db: Session) -> str:
    while True:
        token = secrets.token_urlsafe(16)
        exists = db.scalars(select(models.Pelada.id).where(models.Pelada.public_token == token)).first()
        if not exists:
            return token


def ensure_confirmation_token(db: Session, pelada: models.Pelada) -> str:
    if not pelada.public_token:
        pelada.public_token = _generate_unique_token(db)
        db.commit()
    return pelada.public_token


def rotate_confirmation_token(db: Session, pelada: models.Pelada) -> str:
    pelada.public_token = _generate_unique_token(db)
    db.commit()
    return pelada.public_token


def set_player_presence(db: Session, pelada: models.Pelada, player_id: int, status: str) -> models.Player:
    if status not in (PRESENCE_CONFIRMED, PRESENCE_DECLINED, PRESENCE_PENDING):
        raise ValueError("Status de presenca invalido.")
    player = get_player(db, player_id, pelada.id)
    if player is None:
        raise ValueError("Jogador nao encontrado nesta pelada.")
    player.presence = status
    player.is_active = status == PRESENCE_CONFIRMED
    db.commit()
    db.refresh(player)
    return player


def get_matches(db: Session, pelada_id: int) -> list[schemas.MatchListItem]:
    statement = (
        select(models.Match)
        .where(models.Match.pelada_id == pelada_id)
        .options(selectinload(models.Match.teams), selectinload(models.Match.players))
        .order_by(models.Match.date.desc(), models.Match.created_at.desc())
    )
    matches = list(db.scalars(statement).all())
    return [
        schemas.MatchListItem(
            id=match.id,
            date=match.date,
            title=match.title,
            created_at=match.created_at,
            team_count=len(match.teams),
            player_count=len(match.players),
        )
        for match in matches
    ]


def get_match(db: Session, match_id: int, pelada_id: int) -> models.Match | None:
    statement = (
        select(models.Match)
        .where(models.Match.id == match_id, models.Match.pelada_id == pelada_id)
        .options(
            selectinload(models.Match.teams)
            .selectinload(models.MatchTeam.players)
            .selectinload(models.MatchPlayer.player),
        )
    )
    return db.scalars(statement).first()


def create_match(db: Session, match_data: schemas.MatchCreate, pelada_id: int) -> models.Match:
    _validate_match_payload(db, match_data, pelada_id)

    team_of_the_week_count = sum(1 for team in match_data.teams if team.is_team_of_the_week)
    if team_of_the_week_count > 1:
        raise ValueError("Escolha apenas um melhor time da semana.")

    match = models.Match(pelada_id=pelada_id, date=match_data.date, title=match_data.title)
    db.add(match)
    db.flush()

    for team_data in match_data.teams:
        match_team = models.MatchTeam(
            pelada_id=pelada_id,
            match_id=match.id,
            name=team_data.name,
            total_rating=team_data.total_rating,
            is_team_of_the_week=team_data.is_team_of_the_week,
        )
        db.add(match_team)
        db.flush()

        for player_data in team_data.players:
            db.add(
                models.MatchPlayer(
                    pelada_id=pelada_id,
                    match_id=match.id,
                    team_id=match_team.id,
                    player_id=player_data.player_id,
                    goals=player_data.goals,
                    assists=player_data.assists,
                    was_in_team_of_the_week=match_team.is_team_of_the_week,
                )
            )

    db.commit()
    return get_match(db, match.id, pelada_id)


def update_match_stats(
    db: Session,
    match: models.Match,
    stats_data: schemas.MatchStatsUpdate,
    pelada_id: int,
) -> models.Match:
    validate_match_integrity(db, match, pelada_id)

    stat_ids = [player_stats.id for player_stats in stats_data.players]
    if len(stat_ids) != len(set(stat_ids)):
        raise ValueError("Um jogador foi informado mais de uma vez nas estatisticas.")

    players_by_id = {match_player.id: match_player for match_player in match.players}
    teams_by_id = {team.id: team for team in match.teams}

    if stats_data.team_of_the_week_id is not None and stats_data.team_of_the_week_id not in teams_by_id:
        raise ValueError("O melhor time precisa pertencer a esta pelada.")

    for player_stats in stats_data.players:
        match_player = players_by_id.get(player_stats.id)
        if match_player is None:
            raise ValueError("Jogador informado nao pertence a esta pelada.")
        match_player.goals = player_stats.goals
        match_player.assists = player_stats.assists

    for team in match.teams:
        team.is_team_of_the_week = team.id == stats_data.team_of_the_week_id
        for match_player in team.players:
            match_player.was_in_team_of_the_week = team.is_team_of_the_week

    db.commit()
    return get_match(db, match.id, pelada_id)


def delete_match(db: Session, match: models.Match) -> None:
    db.delete(match)
    db.commit()


def get_player_profile(db: Session, player: models.Player, pelada_id: int) -> schemas.PlayerProfile:
    statement = (
        select(models.MatchPlayer)
        .where(models.MatchPlayer.player_id == player.id, models.MatchPlayer.pelada_id == pelada_id)
        .join(models.MatchPlayer.match)
        .options(selectinload(models.MatchPlayer.match), selectinload(models.MatchPlayer.team))
        .order_by(models.Match.date.desc(), models.Match.created_at.desc())
    )
    entries = list(db.scalars(statement).all())
    total_matches = len(entries)
    total_goals = sum(entry.goals for entry in entries)
    total_assists = sum(entry.assists for entry in entries)
    team_of_the_week_count = sum(1 for entry in entries if entry.was_in_team_of_the_week)

    return schemas.PlayerProfile(
        player=schemas.PlayerRead.model_validate(player),
        total_matches=total_matches,
        total_goals=total_goals,
        total_assists=total_assists,
        average_goals=round(total_goals / total_matches, 2) if total_matches else 0,
        average_assists=round(total_assists / total_matches, 2) if total_matches else 0,
        team_of_the_week_count=team_of_the_week_count,
        history=[
            schemas.PlayerMatchHistoryItem(
                match_id=entry.match_id,
                date=entry.match.date,
                title=entry.match.title,
                team_name=entry.team.name,
                goals=entry.goals,
                assists=entry.assists,
                was_in_team_of_the_week=entry.was_in_team_of_the_week,
            )
            for entry in entries
        ],
    )


def _validate_match_payload(db: Session, match_data: schemas.MatchCreate, pelada_id: int) -> None:
    player_ids = [player.player_id for team in match_data.teams for player in team.players]
    if len(player_ids) != len(set(player_ids)):
        raise ValueError("Um jogador nao pode aparecer em mais de um time na mesma pelada.")

    existing_ids = set(
        db.scalars(
            select(models.Player.id).where(
                models.Player.id.in_(player_ids),
                models.Player.pelada_id == pelada_id,
            )
        ).all()
    )
    missing_ids = set(player_ids) - existing_ids
    if missing_ids:
        raise ValueError("Um ou mais jogadores da pelada nao foram encontrados.")


def validate_match_integrity(db: Session, match: models.Match, pelada_id: int) -> None:
    if match.pelada_id != pelada_id:
        raise ValueError("Pelada nao pertence a este usuario.")

    match_team_ids = {team.id for team in match.teams}
    for team in match.teams:
        if team.pelada_id != pelada_id or team.match_id != match.id:
            raise ValueError("Time informado nao pertence a esta pelada.")

    for match_player in match.players:
        if match_player.pelada_id != pelada_id or match_player.match_id != match.id:
            raise ValueError("Jogador informado nao pertence a esta pelada.")
        if match_player.team_id not in match_team_ids:
            raise ValueError("Jogador informado nao pertence a um time desta pelada.")
        if match_player.player.pelada_id != pelada_id:
            raise ValueError("Jogador informado nao pertence a esta pelada.")
