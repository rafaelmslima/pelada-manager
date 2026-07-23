import secrets
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app import models, schemas


PRESENCE_CONFIRMED = "confirmed"
PRESENCE_DECLINED = "declined"
PRESENCE_PENDING = "pending"


# Fuso de Brasilia para a logica de mensalidade (mes atual / dia de vencimento).
# Usa a base IANA se disponivel; senao cai no offset fixo UTC-3 (Brasil sem horario de verao).
try:
    from zoneinfo import ZoneInfo

    _BRT = ZoneInfo("America/Sao_Paulo")
except Exception:  # noqa: BLE001 - fallback quando nao ha tzdata no ambiente
    _BRT = timezone(timedelta(hours=-3))


def brasilia_today() -> date:
    return datetime.now(_BRT).date()


def current_month() -> str:
    return brasilia_today().strftime("%Y-%m")


def today_iso() -> str:
    return brasilia_today().isoformat()


def mensalista_up_to_date(player: models.Player) -> bool:
    return player.paid_month == current_month()


def diarista_paid_today(player: models.Player) -> bool:
    """Diarista que pagou a diaria da pelada de hoje (reseta sozinho a cada dia, fuso BRT)."""
    return player.paid_date == today_iso()


def mensalista_overdue(player: models.Player, due_day: int) -> bool:
    """Mensalista atrasado: nao pagou o mes atual E ja passou o dia de vencimento (fuso BRT)."""
    if player.billing_type != "mensalista":
        return False
    if mensalista_up_to_date(player):
        return False
    return brasilia_today().day > max(1, due_day)


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


def toggle_player_paid(db: Session, player: models.Player) -> models.Player:
    player.has_paid = not player.has_paid
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


# --- Multi-pelada (membros / troca / convite) ---

def get_user_peladas(db: Session, user: models.User) -> list[tuple[models.Pelada, str]]:
    """Peladas que o usuario possui ou participa, com o papel. Ordenado por criacao."""
    result: dict[int, tuple[models.Pelada, str]] = {}
    for pelada in user.owned_peladas:
        result[pelada.id] = (pelada, "owner")
    for membership in user.memberships:
        result.setdefault(membership.pelada_id, (membership.pelada, membership.role))
    return sorted(result.values(), key=lambda item: item[0].created_at)


def user_can_access_pelada(user: models.User, pelada_id: int) -> bool:
    if any(p.id == pelada_id for p in user.owned_peladas):
        return True
    return any(m.pelada_id == pelada_id for m in user.memberships)


def create_pelada_for_user(
    db: Session, user: models.User, name: str, location: str, match_time: str
) -> models.Pelada:
    pelada = models.Pelada(name=name, location=location, match_time=match_time, owner_user_id=user.id)
    db.add(pelada)
    db.flush()
    db.add(models.PeladaMember(user_id=user.id, pelada_id=pelada.id, role="owner"))
    user.active_pelada_id = pelada.id
    db.commit()
    db.refresh(user)
    return pelada


def select_pelada(db: Session, user: models.User, pelada_id: int) -> None:
    if not user_can_access_pelada(user, pelada_id):
        raise ValueError("Voce nao participa desta pelada.")
    user.active_pelada_id = pelada_id
    db.commit()
    db.refresh(user)


def _generate_unique_invite(db: Session) -> str:
    while True:
        code = secrets.token_urlsafe(6)
        if not db.scalars(select(models.Pelada.id).where(models.Pelada.invite_code == code)).first():
            return code


def ensure_invite_code(db: Session, pelada: models.Pelada) -> str:
    if not pelada.invite_code:
        pelada.invite_code = _generate_unique_invite(db)
        db.commit()
    return pelada.invite_code


def join_pelada_by_code(db: Session, user: models.User, code: str) -> models.Pelada:
    pelada = db.scalars(select(models.Pelada).where(models.Pelada.invite_code == code.strip())).first()
    if pelada is None:
        raise ValueError("Codigo de convite invalido.")
    if not user_can_access_pelada(user, pelada.id):
        db.add(models.PeladaMember(user_id=user.id, pelada_id=pelada.id, role="member"))
    user.active_pelada_id = pelada.id
    db.commit()
    db.refresh(user)
    return pelada


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


def register_device_token(db: Session, user: models.User, token: str, platform: str) -> models.DeviceToken:
    existing = db.scalars(select(models.DeviceToken).where(models.DeviceToken.token == token)).first()
    if existing:
        existing.user_id = user.id
        existing.platform = platform
        db.commit()
        db.refresh(existing)
        return existing
    device = models.DeviceToken(user_id=user.id, token=token, platform=platform)
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


def delete_device_token(db: Session, token: str) -> None:
    device = db.scalars(select(models.DeviceToken).where(models.DeviceToken.token == token)).first()
    if device:
        db.delete(device)
        db.commit()


def get_pelada_device_tokens(db: Session, pelada: models.Pelada) -> list[str]:
    """Tokens de push dos usuarios ligados a pelada. Hoje: o dono (organizador).
    Quando jogadores virarem usuarios (multi-pelada), incluira os membros."""
    user_ids = [pelada.owner_user_id]
    tokens = db.scalars(
        select(models.DeviceToken.token).where(models.DeviceToken.user_id.in_(user_ids))
    ).all()
    return list(tokens)


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


def increment_match_player_stats(
    db: Session,
    match: models.Match,
    match_player_id: int,
    goals_delta: int,
    assists_delta: int,
    pelada_id: int,
) -> models.Match:
    """Placar ao vivo: incrementa gols/assistencias de um jogador da partida (nao fica negativo)."""
    if match.pelada_id != pelada_id:
        raise ValueError("Pelada nao pertence a este usuario.")
    match_player = next((mp for mp in match.players if mp.id == match_player_id), None)
    if match_player is None:
        raise ValueError("Jogador da partida nao encontrado.")
    match_player.goals = max(0, match_player.goals + goals_delta)
    match_player.assists = max(0, match_player.assists + assists_delta)
    db.commit()
    return get_match(db, match.id, pelada_id)


def create_round(
    db: Session,
    match: models.Match,
    data: schemas.RoundCreate,
    pelada_id: int,
) -> None:
    """Salva um confronto (Time A x Time B) e soma os gols/assist no total do jogador."""
    validate_match_integrity(db, match, pelada_id)
    team_ids = {team.id for team in match.teams}
    if data.team_a_id not in team_ids or data.team_b_id not in team_ids:
        raise ValueError("Times do confronto nao pertencem a esta pelada.")
    if data.team_a_id == data.team_b_id:
        raise ValueError("Um time nao pode jogar contra ele mesmo.")

    match_players_by_player = {mp.player_id: mp for mp in match.players}

    match_round = models.MatchRound(
        pelada_id=pelada_id,
        match_id=match.id,
        team_a_id=data.team_a_id,
        team_b_id=data.team_b_id,
        goals_a=data.goals_a,
        goals_b=data.goals_b,
        duration_seconds=data.duration_seconds,
    )
    db.add(match_round)
    db.flush()

    for stat in data.stats:
        if stat.goals <= 0 and stat.assists <= 0:
            continue
        db.add(
            models.RoundPlayerStat(
                pelada_id=pelada_id,
                round_id=match_round.id,
                player_id=stat.player_id,
                goals=stat.goals,
                assists=stat.assists,
            )
        )
        match_player = match_players_by_player.get(stat.player_id)
        if match_player is not None:
            match_player.goals += stat.goals
            match_player.assists += stat.assists

    # Credita vitoria aos jogadores do lado vencedor (empate nao credita). Usa o elenco
    # efetivo enviado pelo app (base + reforcos), agregado em MatchPlayer.wins.
    if data.goals_a != data.goals_b:
        winners = data.team_a_players if data.goals_a > data.goals_b else data.team_b_players
        for player_id in winners:
            match_player = match_players_by_player.get(player_id)
            if match_player is not None:
                match_player.wins += 1

    db.commit()


def delete_match_rounds(db: Session, match: models.Match) -> None:
    """Apaga os confrontos do dia (economiza banco). Mantem os agregados de MatchPlayer
    (gols/assist/vitorias) e limpa o confronto ao vivo pendente."""
    rounds = list(
        db.scalars(select(models.MatchRound).where(models.MatchRound.match_id == match.id)).all()
    )
    for match_round in rounds:
        db.delete(match_round)  # cascade remove os RoundPlayerStat
    match.live_state = None
    db.commit()


def set_match_live_state(db: Session, match: models.Match, state: str | None) -> None:
    """Salva/limpa o estado do confronto ao vivo em andamento (JSON do app)."""
    match.live_state = state
    db.commit()


def get_rounds_overview(db: Session, match: models.Match, pelada_id: int) -> schemas.RoundsOverview:
    rounds = list(
        db.scalars(
            select(models.MatchRound)
            .where(models.MatchRound.match_id == match.id, models.MatchRound.pelada_id == pelada_id)
            .order_by(models.MatchRound.created_at.asc())
        ).all()
    )
    teams_by_id = {team.id: team for team in match.teams}

    standings: dict[int, dict] = {
        team.id: {
            "team_id": team.id,
            "name": team.name,
            "played": 0,
            "wins": 0,
            "draws": 0,
            "losses": 0,
            "goals_for": 0,
            "goals_against": 0,
            "points": 0,
        }
        for team in match.teams
    }

    round_reads: list[schemas.RoundRead] = []
    for match_round in rounds:
        team_a = teams_by_id.get(match_round.team_a_id)
        team_b = teams_by_id.get(match_round.team_b_id)
        round_reads.append(
            schemas.RoundRead(
                id=match_round.id,
                team_a_id=match_round.team_a_id,
                team_b_id=match_round.team_b_id,
                team_a_name=team_a.name if team_a else "Time A",
                team_b_name=team_b.name if team_b else "Time B",
                goals_a=match_round.goals_a,
                goals_b=match_round.goals_b,
                duration_seconds=match_round.duration_seconds,
            )
        )
        a = standings.get(match_round.team_a_id)
        b = standings.get(match_round.team_b_id)
        if a is None or b is None:
            continue
        a["played"] += 1
        b["played"] += 1
        a["goals_for"] += match_round.goals_a
        a["goals_against"] += match_round.goals_b
        b["goals_for"] += match_round.goals_b
        b["goals_against"] += match_round.goals_a
        if match_round.goals_a > match_round.goals_b:
            a["wins"] += 1
            b["losses"] += 1
            a["points"] += 3
        elif match_round.goals_a < match_round.goals_b:
            b["wins"] += 1
            a["losses"] += 1
            b["points"] += 3
        else:
            a["draws"] += 1
            b["draws"] += 1
            a["points"] += 1
            b["points"] += 1

    table = [
        schemas.TeamStanding(**row)
        for row in sorted(
            standings.values(),
            key=lambda r: (r["points"], r["goals_for"] - r["goals_against"], r["goals_for"]),
            reverse=True,
        )
    ]

    # Artilheiro do dia (agregado do MatchPlayer desta pelada).
    top_scorer = None
    best = None
    for match_player in match.players:
        if match_player.goals > 0 and (best is None or match_player.goals > best.goals):
            best = match_player
    if best is not None:
        top_scorer = schemas.TopScorer(
            player_id=best.player_id, name=best.player.name, goals=best.goals
        )

    champion = table[0] if table and table[0].played > 0 else None
    return schemas.RoundsOverview(
        rounds=round_reads, standings=table, top_scorer=top_scorer, champion=champion
    )


def get_match_ratings(db: Session, match_id: int, pelada_id: int) -> dict[int, float]:
    rows = db.execute(
        select(models.PlayerRating.player_id, models.PlayerRating.score).where(
            models.PlayerRating.match_id == match_id,
            models.PlayerRating.pelada_id == pelada_id,
        )
    ).all()
    return {player_id: score for player_id, score in rows}


def save_match_ratings(
    db: Session,
    match: models.Match,
    ratings: list[tuple[int, float]],
    pelada_id: int,
) -> None:
    """Salva/atualiza as notas pos-jogo e realimenta o rating do jogador (media das notas)."""
    validate_match_integrity(db, match, pelada_id)
    match_player_ids = {mp.player_id for mp in match.players}

    existing = {
        rating.player_id: rating
        for rating in db.scalars(
            select(models.PlayerRating).where(
                models.PlayerRating.match_id == match.id,
                models.PlayerRating.pelada_id == pelada_id,
            )
        ).all()
    }

    affected: set[int] = set()
    for player_id, score in ratings:
        if player_id not in match_player_ids:
            raise ValueError("Jogador avaliado nao participou desta pelada.")
        clamped = min(5.0, max(0.0, float(score)))
        if player_id in existing:
            existing[player_id].score = clamped
        else:
            db.add(
                models.PlayerRating(
                    pelada_id=pelada_id,
                    match_id=match.id,
                    player_id=player_id,
                    score=clamped,
                )
            )
        affected.add(player_id)

    db.flush()
    for player_id in affected:
        _recompute_player_rating(db, player_id, pelada_id)
    db.commit()


def _recompute_player_rating(db: Session, player_id: int, pelada_id: int) -> None:
    """Rating do jogador = media das notas recebidas nas peladas (evolucao ao longo do tempo)."""
    scores = list(
        db.scalars(
            select(models.PlayerRating.score).where(
                models.PlayerRating.player_id == player_id,
                models.PlayerRating.pelada_id == pelada_id,
            )
        ).all()
    )
    if not scores:
        return
    average = round(sum(scores) / len(scores), 1)
    player = get_player(db, player_id, pelada_id)
    if player is not None:
        player.rating = min(5.0, max(0.0, average))


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
    total_wins = sum(entry.wins for entry in entries)
    team_of_the_week_count = sum(1 for entry in entries if entry.was_in_team_of_the_week)

    return schemas.PlayerProfile(
        player=schemas.PlayerRead.model_validate(player),
        total_matches=total_matches,
        total_goals=total_goals,
        total_assists=total_assists,
        total_wins=total_wins,
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


# --- Financeiro ---

def _finance_entry_read(entry: models.FinanceEntry) -> schemas.FinanceEntryRead:
    return schemas.FinanceEntryRead(
        id=entry.id,
        kind=entry.kind,
        amount=entry.amount,
        description=entry.description,
        player_id=entry.player_id,
        player_name=entry.player.name if entry.player else None,
        created_at=entry.created_at,
    )


def get_finance_overview(db: Session, pelada: models.Pelada) -> schemas.FinanceOverview:
    entries = list(
        db.scalars(
            select(models.FinanceEntry)
            .where(models.FinanceEntry.pelada_id == pelada.id)
            .options(selectinload(models.FinanceEntry.player))
            .order_by(models.FinanceEntry.created_at.desc())
        ).all()
    )
    income = sum(e.amount for e in entries if e.kind == "income")
    expense = sum(e.amount for e in entries if e.kind == "expense")
    players = get_players(db, pelada.id)
    mensalistas = [p for p in players if p.billing_type == "mensalista"]
    # Diaristas confirmados (presentes hoje) sao os que devem a diaria da pelada.
    diaristas = [p for p in players if p.billing_type == "diarista" and p.is_active]
    return schemas.FinanceOverview(
        daily_fee=pelada.daily_fee,
        monthly_fee=pelada.monthly_fee,
        monthly_due_day=pelada.monthly_due_day,
        total_income=round(income, 2),
        total_expense=round(expense, 2),
        balance=round(income - expense, 2),
        mensalistas=[
            schemas.MensalistaStatus(
                player_id=p.id,
                name=p.name,
                up_to_date=mensalista_up_to_date(p),
                overdue=mensalista_overdue(p, pelada.monthly_due_day),
            )
            for p in mensalistas
        ],
        diaristas=[
            schemas.DiaristaStatus(
                player_id=p.id,
                name=p.name,
                paid=diarista_paid_today(p),
            )
            for p in diaristas
        ],
        entries=[_finance_entry_read(e) for e in entries],
    )


def create_finance_entry(db: Session, pelada_id: int, data: schemas.FinanceEntryCreate) -> models.FinanceEntry:
    if data.player_id is not None and get_player(db, data.player_id, pelada_id) is None:
        raise ValueError("Jogador nao encontrado nesta pelada.")
    entry = models.FinanceEntry(
        pelada_id=pelada_id,
        kind=data.kind,
        amount=data.amount,
        description=data.description,
        player_id=data.player_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def get_finance_entry(db: Session, entry_id: int, pelada_id: int) -> models.FinanceEntry | None:
    return db.scalars(
        select(models.FinanceEntry).where(
            models.FinanceEntry.id == entry_id, models.FinanceEntry.pelada_id == pelada_id
        )
    ).first()


def delete_finance_entry(db: Session, entry: models.FinanceEntry) -> None:
    # Se for o lancamento automatico de um pagamento, volta o jogador para pendente
    # (mantem o extrato e a lista de mensalistas/diaristas em sincronia).
    player = entry.player
    ref = entry.ref_period
    if player is not None and ref:
        if player.paid_month == ref:
            player.paid_month = None
        if player.paid_date == ref:
            player.paid_date = None
    db.delete(entry)
    db.commit()


def set_finance_settings(
    db: Session, pelada: models.Pelada, daily_fee: float, monthly_fee: float, monthly_due_day: int
) -> None:
    pelada.daily_fee = max(0.0, daily_fee)
    pelada.monthly_fee = max(0.0, monthly_fee)
    pelada.monthly_due_day = min(28, max(1, monthly_due_day))
    db.commit()


def _add_payment_income(
    db: Session, player: models.Player, amount: float, ref_period: str, description: str
) -> None:
    """Lanca uma entrada no caixa vinculada a um pagamento (mensalidade/diaria)."""
    if amount <= 0:
        return
    db.add(
        models.FinanceEntry(
            pelada_id=player.pelada_id,
            kind="income",
            amount=round(amount, 2),
            description=description,
            player_id=player.id,
            ref_period=ref_period,
        )
    )


def _remove_payment_income(db: Session, player: models.Player, ref_period: str) -> None:
    """Estorna do caixa o(s) lancamento(s) automatico(s) daquele jogador/periodo."""
    db.query(models.FinanceEntry).filter(
        models.FinanceEntry.pelada_id == player.pelada_id,
        models.FinanceEntry.player_id == player.id,
        models.FinanceEntry.ref_period == ref_period,
        models.FinanceEntry.kind == "income",
    ).delete(synchronize_session=False)


def toggle_player_monthly_paid(
    db: Session, pelada: models.Pelada, player: models.Player
) -> models.Player:
    """Marca/desmarca a mensalidade do mes atual (reseta sozinho na virada do mes).

    Ao marcar como pago, o caixa recebe automaticamente o valor da mensalidade
    configurada na pelada; ao desmarcar, o lancamento e estornado.
    """
    month = current_month()
    if mensalista_up_to_date(player):
        player.paid_month = None
        _remove_payment_income(db, player, month)
    else:
        player.paid_month = month
        _add_payment_income(db, player, pelada.monthly_fee, month, f"Mensalidade — {player.name}")
    db.commit()
    db.refresh(player)
    return player


def toggle_player_daily_paid(
    db: Session, pelada: models.Pelada, player: models.Player
) -> models.Player:
    """Marca/desmarca a diaria da pelada de hoje (reseta sozinho a cada dia).

    Ao marcar como pago, o caixa recebe automaticamente o valor da diaria
    configurada na pelada; ao desmarcar, o lancamento e estornado.
    """
    day = today_iso()
    if diarista_paid_today(player):
        player.paid_date = None
        _remove_payment_income(db, player, day)
    else:
        player.paid_date = day
        _add_payment_income(db, player, pelada.daily_fee, day, f"Diária — {player.name}")
    db.commit()
    db.refresh(player)
    return player


def overdue_confirmed_mensalistas(db: Session, pelada: models.Pelada) -> list[models.Player]:
    """Mensalistas confirmados (no sorteio) que estao com a mensalidade atrasada."""
    return [
        p
        for p in get_active_players(db, pelada.id)
        if mensalista_overdue(p, pelada.monthly_due_day)
    ]


def collect_daily_from_confirmed(db: Session, pelada: models.Pelada) -> models.FinanceEntry | None:
    """Lanca uma entrada = diaria x (diaristas confirmados). Retorna None se nao houver o que cobrar."""
    if pelada.daily_fee <= 0:
        raise ValueError("Configure o valor da diaria primeiro.")
    confirmed_diaristas = [
        p for p in get_players(db, pelada.id) if p.is_active and p.billing_type == "diarista"
    ]
    if not confirmed_diaristas:
        return None
    total = round(pelada.daily_fee * len(confirmed_diaristas), 2)
    entry = models.FinanceEntry(
        pelada_id=pelada.id,
        kind="income",
        amount=total,
        description=f"Diárias ({len(confirmed_diaristas)} jogadores)",
        player_id=None,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


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
