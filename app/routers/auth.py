from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import (
    SESSION_COOKIE_NAME,
    clear_session,
    create_session,
    get_current_pelada,
    get_current_user,
    login_user,
    require_user,
    register_user,
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
    create_session(response, db, user)
    return serialize_current_user(user)


@router.post("/login", response_model=schemas.AuthMeResponse)
def login(
    payload: schemas.AuthLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    user = login_user(db, payload)
    create_session(response, db, user)
    return serialize_current_user(user)


@router.post("/logout")
def logout(
    response: Response,
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    clear_session(response, db, session_token)
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
