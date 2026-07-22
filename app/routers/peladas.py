from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.auth import get_current_pelada, require_user, serialize_current_user
from app.database import get_db


router = APIRouter(prefix="/api/peladas", tags=["peladas"])


def _link_response(token: str) -> schemas.ConfirmationLinkResponse:
    return schemas.ConfirmationLinkResponse(token=token, path=f"/confirmar/{token}")


@router.get("", response_model=list[schemas.PeladaMembershipRead])
def list_my_peladas(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    active_id = current_user.active_pelada_id
    return [
        schemas.PeladaMembershipRead(
            id=pelada.id,
            name=pelada.name,
            location=pelada.location,
            match_time=pelada.match_time,
            role=role,
            is_active=pelada.id == active_id,
        )
        for pelada, role in crud.get_user_peladas(db, current_user)
    ]


@router.post("", response_model=schemas.AuthMeResponse, status_code=status.HTTP_201_CREATED)
def create_pelada(
    payload: schemas.PeladaCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    crud.create_pelada_for_user(db, current_user, payload.name, payload.location, payload.match_time)
    return serialize_current_user(current_user)


@router.post("/{pelada_id}/select", response_model=schemas.AuthMeResponse)
def select_pelada(
    pelada_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    try:
        crud.select_pelada(db, current_user, pelada_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    return serialize_current_user(current_user)


@router.post("/join", response_model=schemas.AuthMeResponse)
def join_pelada(
    payload: schemas.JoinPeladaRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    try:
        crud.join_pelada_by_code(db, current_user, payload.invite_code)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return serialize_current_user(current_user)


@router.get("/invite-code", response_model=schemas.InviteCodeResponse)
def get_invite_code(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    """Codigo de convite da pelada ativa (gera se necessario)."""
    pelada = get_current_pelada(current_user)
    return schemas.InviteCodeResponse(invite_code=crud.ensure_invite_code(db, pelada))


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
