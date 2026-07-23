from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import billing, crud, models, schemas
from app.auth import get_current_pelada, require_user, serialize_current_user
from app.database import get_db


router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("/status", response_model=schemas.BillingStatus)
def billing_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    limits = billing.limits_for(current_user)
    try:
        pelada = get_current_pelada(current_user)
        players_count = len(crud.get_players(db, pelada.id))
    except Exception:  # noqa: BLE001 - usuario pode nao ter pelada ainda
        players_count = 0
    return schemas.BillingStatus(
        plan=current_user.plan,
        is_premium=billing.is_premium(current_user),
        max_peladas=limits["max_peladas"],
        max_players=limits["max_players"],
        peladas_count=len(current_user.owned_peladas),
        players_count=players_count,
    )


@router.post("/activate", response_model=schemas.AuthMeResponse)
def activate(
    payload: schemas.PlanActivateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    billing.activate_premium(db, current_user, payload.code)
    db.refresh(current_user)
    return serialize_current_user(current_user)
