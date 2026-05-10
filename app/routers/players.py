from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.auth import get_current_pelada, require_user
from app.database import get_db


router = APIRouter(prefix="/api/players", tags=["players"])


@router.get("", response_model=list[schemas.PlayerRead])
def list_players(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    return crud.get_players(db, pelada.id)


@router.get("/{player_id}/profile", response_model=schemas.PlayerProfile)
def get_player_profile(
    player_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    player = crud.get_player(db, player_id, pelada.id)
    if player is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jogador nao encontrado.")
    return crud.get_player_profile(db, player, pelada.id)


@router.post("", response_model=schemas.PlayerRead, status_code=status.HTTP_201_CREATED)
def create_player(
    player_data: schemas.PlayerCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    return crud.create_player(db, player_data, pelada.id)


@router.put("/{player_id}", response_model=schemas.PlayerRead)
def update_player(
    player_id: int,
    player_data: schemas.PlayerUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    player = crud.get_player(db, player_id, pelada.id)
    if player is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jogador nao encontrado.")
    return crud.update_player(db, player, player_data)


@router.delete("/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_player(
    player_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    player = crud.get_player(db, player_id, pelada.id)
    if player is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jogador nao encontrado.")
    try:
        crud.delete_player(db, player, pelada.id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.patch("/{player_id}/toggle-active", response_model=schemas.PlayerRead)
def toggle_player_active(
    player_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    player = crud.get_player(db, player_id, pelada.id)
    if player is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jogador nao encontrado.")
    return crud.toggle_player_active(db, player)
