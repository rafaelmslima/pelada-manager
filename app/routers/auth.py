from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import (
    SESSION_COOKIE_NAME,
    admin_reset_password,
    clear_session,
    create_session,
    enforce_rate_limit,
    get_current_pelada,
    get_current_user,
    login_user,
    require_user,
    register_user,
    resolve_session_token,
    serialize_current_user,
)
from app.database import get_db


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=schemas.AuthMeResponse, status_code=201)
def register(
    payload: schemas.AuthRegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    user = register_user(db, payload)
    token = create_session(response, db, user)
    return serialize_current_user(user, token=token)


@router.post("/login", response_model=schemas.AuthMeResponse)
def login(
    payload: schemas.AuthLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    enforce_rate_limit(f"login:{_client_key(request)}:{payload.email}", max_attempts=10, window_seconds=300)
    user = login_user(db, payload)
    token = create_session(response, db, user)
    return serialize_current_user(user, token=token)


@router.post("/admin-reset-password", response_model=schemas.AdminPasswordResetResponse)
def reset_password_without_login(
    payload: schemas.AdminPasswordResetRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_rate_limit(f"admin-reset:{_client_key(request)}:{payload.email}", max_attempts=5, window_seconds=300)
    admin_reset_password(db, payload)
    return schemas.AdminPasswordResetResponse(ok=True)


@router.post("/logout")
def logout(
    response: Response,
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    authorization: str | None = Header(default=None),
):
    clear_session(response, db, resolve_session_token(session_token, authorization))
    return {"ok": True}


@router.get("/me", response_model=schemas.AuthMeResponse)
def me(current_user: models.User | None = Depends(get_current_user)):
    if current_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessao invalida ou expirada.")
    return serialize_current_user(current_user)


@router.put("/pelada", response_model=schemas.AuthMeResponse)
def update_pelada(
    payload: schemas.PeladaUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    pelada.name = payload.name
    pelada.location = payload.location
    pelada.match_time = payload.match_time or "20:00"
    pelada.default_billing_type = payload.default_billing_type
    db.commit()
    db.refresh(current_user)
    return serialize_current_user(current_user)


def _client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"
