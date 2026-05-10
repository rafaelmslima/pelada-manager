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
