from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.auth import require_user
from app.database import get_db


router = APIRouter(prefix="/api/devices", tags=["devices"])


@router.post("", response_model=schemas.OkResponse)
def register_device(
    payload: schemas.DeviceTokenRegister,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    """Registra o Expo push token do device do usuario logado."""
    crud.register_device_token(db, current_user, payload.token.strip(), payload.platform.strip())
    return schemas.OkResponse(ok=True)


@router.delete("", response_model=schemas.OkResponse)
def unregister_device(
    payload: schemas.DeviceTokenDelete,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    """Remove o token do device (ex.: no logout)."""
    crud.delete_device_token(db, payload.token.strip())
    return schemas.OkResponse(ok=True)
