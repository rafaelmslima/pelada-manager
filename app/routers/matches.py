from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.auth import get_current_pelada, require_user
from app.database import get_db


router = APIRouter(prefix="/api/matches", tags=["matches"])


@router.get("", response_model=list[schemas.MatchListItem])
def list_matches(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    return crud.get_matches(db, pelada.id)


@router.post("", response_model=schemas.MatchRead, status_code=status.HTTP_201_CREATED)
def create_match(
    match_data: schemas.MatchCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    try:
        return crud.create_match(db, match_data, pelada.id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.get("/{match_id}", response_model=schemas.MatchRead)
def get_match(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    match = crud.get_match(db, match_id, pelada.id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pelada nao encontrada.")
    return match


@router.put("/{match_id}/stats", response_model=schemas.MatchRead)
def update_match_stats(
    match_id: int,
    stats_data: schemas.MatchStatsUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    match = crud.get_match(db, match_id, pelada.id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pelada nao encontrada.")

    try:
        return crud.update_match_stats(db, match, stats_data, pelada.id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.post("/{match_id}/players/{match_player_id}/event", response_model=schemas.MatchRead)
def register_match_event(
    match_id: int,
    match_player_id: int,
    event: schemas.MatchPlayerEvent,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    """Placar ao vivo: incrementa gol/assistencia de um jogador da partida."""
    pelada = get_current_pelada(current_user)
    match = crud.get_match(db, match_id, pelada.id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pelada nao encontrada.")
    try:
        return crud.increment_match_player_stats(
            db, match, match_player_id, event.goals_delta, event.assists_delta, pelada.id
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.get("/{match_id}/rounds", response_model=schemas.RoundsOverview)
def get_rounds(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    match = crud.get_match(db, match_id, pelada.id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pelada nao encontrada.")
    return crud.get_rounds_overview(db, match, pelada.id)


@router.post("/{match_id}/rounds", response_model=schemas.RoundsOverview, status_code=status.HTTP_201_CREATED)
def create_round(
    match_id: int,
    payload: schemas.RoundCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    """Salva um confronto (Time A x Time B) da pelada ao vivo."""
    pelada = get_current_pelada(current_user)
    match = crud.get_match(db, match_id, pelada.id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pelada nao encontrada.")
    try:
        crud.create_round(db, match, payload, pelada.id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    match = crud.get_match(db, match_id, pelada.id)
    return crud.get_rounds_overview(db, match, pelada.id)


@router.delete("/{match_id}/rounds", response_model=schemas.MatchRead)
def clear_rounds(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    """Encerra o dia: apaga os confrontos (economiza banco) e mantem os agregados dos jogadores."""
    pelada = get_current_pelada(current_user)
    match = crud.get_match(db, match_id, pelada.id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pelada nao encontrada.")
    crud.delete_match_rounds(db, match)
    return crud.get_match(db, match_id, pelada.id)


@router.put("/{match_id}/live", response_model=schemas.MatchRead)
def save_live_state(
    match_id: int,
    payload: schemas.LiveStateUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    """Salva o confronto ao vivo em andamento (para retomar ao voltar/tocar na notificacao)."""
    pelada = get_current_pelada(current_user)
    match = crud.get_match(db, match_id, pelada.id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pelada nao encontrada.")
    crud.set_match_live_state(db, match, payload.state)
    return crud.get_match(db, match_id, pelada.id)


@router.delete("/{match_id}/live", response_model=schemas.MatchRead)
def clear_live_state(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    """Limpa o confronto ao vivo pendente (confronto finalizado)."""
    pelada = get_current_pelada(current_user)
    match = crud.get_match(db, match_id, pelada.id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pelada nao encontrada.")
    crud.set_match_live_state(db, match, None)
    return crud.get_match(db, match_id, pelada.id)


@router.get("/{match_id}/ratings", response_model=list[schemas.MatchRatingRead])
def get_match_ratings(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    match = crud.get_match(db, match_id, pelada.id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pelada nao encontrada.")
    ratings = crud.get_match_ratings(db, match_id, pelada.id)
    return [schemas.MatchRatingRead(player_id=pid, score=score) for pid, score in ratings.items()]


@router.post("/{match_id}/ratings", response_model=schemas.MatchRead)
def save_match_ratings(
    match_id: int,
    payload: schemas.MatchRatingsUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    """Avaliacao pos-jogo: salva as notas e realimenta o rating dos jogadores."""
    pelada = get_current_pelada(current_user)
    match = crud.get_match(db, match_id, pelada.id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pelada nao encontrada.")
    try:
        crud.save_match_ratings(db, match, [(r.player_id, r.score) for r in payload.ratings], pelada.id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    return crud.get_match(db, match_id, pelada.id)


@router.delete("/{match_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_match(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    match = crud.get_match(db, match_id, pelada.id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pelada nao encontrada.")
    crud.delete_match(db, match)
