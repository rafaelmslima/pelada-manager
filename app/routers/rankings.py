from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import get_current_pelada, require_user
from app.database import get_db
from app.services import ranking_service


router = APIRouter(prefix="/api/rankings", tags=["rankings"])


@router.get("/scorers", response_model=schemas.RankingResponse)
def get_scorers_ranking(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    return ranking_service.get_scorers_ranking(db, pelada.id)


@router.get("/assists", response_model=schemas.RankingResponse)
def get_assists_ranking(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    return ranking_service.get_assists_ranking(db, pelada.id)


@router.get("/summary", response_model=schemas.RankingsSummary)
def get_rankings_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    return ranking_service.get_rankings_summary(db, pelada.id)
