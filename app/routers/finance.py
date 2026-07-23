from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.auth import get_current_pelada, require_user
from app.database import get_db


router = APIRouter(prefix="/api/finance", tags=["finance"])


@router.get("", response_model=schemas.FinanceOverview)
def get_overview(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    return crud.get_finance_overview(db, pelada)


@router.put("/settings", response_model=schemas.FinanceOverview)
def update_settings(
    payload: schemas.FinanceSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    crud.set_finance_settings(db, pelada, payload.daily_fee, payload.monthly_fee, payload.monthly_due_day)
    return crud.get_finance_overview(db, pelada)


@router.post("", response_model=schemas.FinanceOverview, status_code=status.HTTP_201_CREATED)
def create_entry(
    payload: schemas.FinanceEntryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    try:
        crud.create_finance_entry(db, pelada.id, payload)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    return crud.get_finance_overview(db, pelada)


@router.post("/collect-daily", response_model=schemas.FinanceOverview)
def collect_daily(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    try:
        crud.collect_daily_from_confirmed(db, pelada)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    return crud.get_finance_overview(db, pelada)


@router.delete("/{entry_id}", response_model=schemas.FinanceOverview)
def delete_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    entry = crud.get_finance_entry(db, entry_id, pelada.id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lancamento nao encontrado.")
    crud.delete_finance_entry(db, entry)
    return crud.get_finance_overview(db, pelada)
