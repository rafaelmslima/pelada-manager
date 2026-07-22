from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.database import get_db


# Rotas publicas (sem autenticacao) para a pagina de confirmacao de presenca.
router = APIRouter(prefix="/api/public", tags=["public"])


def _load_pelada(db: Session, token: str) -> models.Pelada:
    pelada = crud.get_pelada_by_token(db, token)
    if pelada is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link invalido ou expirado.")
    return pelada


def _build_view(db: Session, pelada: models.Pelada) -> schemas.PublicConfirmationView:
    players = crud.get_players(db, pelada.id)
    confirmed = sum(1 for p in players if p.presence == crud.PRESENCE_CONFIRMED)
    declined = sum(1 for p in players if p.presence == crud.PRESENCE_DECLINED)
    return schemas.PublicConfirmationView(
        pelada_name=pelada.name,
        location=pelada.location,
        match_time=pelada.match_time,
        confirmed_count=confirmed,
        declined_count=declined,
        total=len(players),
        players=[
            schemas.PublicConfirmationPlayer(
                id=p.id,
                name=p.name,
                position=p.position,
                presence=p.presence,
            )
            for p in players
        ],
    )


@router.get("/confirmation/{token}", response_model=schemas.PublicConfirmationView)
def get_confirmation(token: str, db: Session = Depends(get_db)):
    pelada = _load_pelada(db, token)
    return _build_view(db, pelada)


@router.post("/confirmation/{token}/players/{player_id}", response_model=schemas.PublicConfirmationView)
def set_confirmation(
    token: str,
    player_id: int,
    payload: schemas.PublicPresenceUpdate,
    db: Session = Depends(get_db),
):
    pelada = _load_pelada(db, token)
    try:
        crud.set_player_presence(db, pelada, player_id, payload.status)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return _build_view(db, pelada)
