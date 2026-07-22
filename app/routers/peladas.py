from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.auth import get_current_pelada, require_user
from app.database import get_db


router = APIRouter(prefix="/api/peladas", tags=["peladas"])


def _link_response(token: str) -> schemas.ConfirmationLinkResponse:
    return schemas.ConfirmationLinkResponse(token=token, path=f"/confirmar/{token}")


@router.post("/confirmation-link", response_model=schemas.ConfirmationLinkResponse)
def get_confirmation_link(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    """Retorna (criando se necessario) o link publico de confirmacao de presenca."""
    pelada = get_current_pelada(current_user)
    token = crud.ensure_confirmation_token(db, pelada)
    return _link_response(token)


@router.post("/confirmation-link/rotate", response_model=schemas.ConfirmationLinkResponse)
def rotate_confirmation_link(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    """Gera um novo token, invalidando o link anterior."""
    pelada = get_current_pelada(current_user)
    token = crud.rotate_confirmation_token(db, pelada)
    return _link_response(token)
