from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import datetime

from fastapi import Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db


SESSION_COOKIE_NAME = "pelada_session"
PBKDF2_ITERATIONS = 120000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations, salt_hex, digest_hex = password_hash.split("$")
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False

    candidate = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt_hex),
        int(iterations),
    )
    return hmac.compare_digest(candidate.hex(), digest_hex)


def create_session(response: Response, db: Session, user: models.User) -> None:
    token = secrets.token_urlsafe(48)
    db.add(models.UserSession(user_id=user.id, token=token))
    db.commit()

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true",
        max_age=60 * 60 * 24 * 30,
    )


def clear_session(response: Response, db: Session, token: str | None) -> None:
    if token:
        session = db.scalars(select(models.UserSession).where(models.UserSession.token == token)).first()
        if session:
            db.delete(session)
            db.commit()

    response.delete_cookie(key=SESSION_COOKIE_NAME)


def _get_user_from_token(db: Session, token: str | None) -> models.User | None:
    if not token:
        return None

    statement = (
        select(models.User)
        .join(models.UserSession, models.UserSession.user_id == models.User.id)
        .where(models.UserSession.token == token)
    )
    return db.scalars(statement).first()


def get_current_user(
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> models.User | None:
    return _get_user_from_token(db, session_token)


def require_user(current_user: models.User | None = Depends(get_current_user)) -> models.User:
    if current_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessao invalida ou expirada.")
    return current_user


def get_current_pelada(user: models.User) -> models.Pelada:
    if user.pelada is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pelada do usuario nao encontrada.")
    return user.pelada


def register_user(db: Session, payload: schemas.AuthRegisterRequest) -> models.User:
    existing = db.scalars(select(models.User).where(models.User.email == payload.email.lower())).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email ja cadastrado.")

    user = models.User(email=payload.email.lower(), password_hash=hash_password(payload.password))
    db.add(user)
    db.flush()

    pelada_name = payload.pelada_name.strip() if payload.pelada_name else f"Pelada de {payload.name.strip()}"
    pelada = models.Pelada(name=pelada_name, owner_user_id=user.id)
    db.add(pelada)
    db.commit()
    db.refresh(pelada)
    _backfill_legacy_rows_without_pelada(db, pelada.id)
    db.refresh(user)
    return user


def login_user(db: Session, payload: schemas.AuthLoginRequest) -> models.User:
    user = db.scalars(select(models.User).where(models.User.email == payload.email.lower())).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou senha invalidos.")
    return user


def serialize_current_user(user: models.User) -> schemas.AuthMeResponse:
    pelada = get_current_pelada(user)
    return schemas.AuthMeResponse(
        user=schemas.UserRead.model_validate(user),
        pelada=schemas.PeladaRead.model_validate(pelada),
        server_time=datetime.utcnow(),
    )


def _backfill_legacy_rows_without_pelada(db: Session, pelada_id: int) -> None:
    # Legacy SQLite databases may have rows created before multi-tenant columns existed.
    db.execute(text("UPDATE players SET pelada_id = :pelada_id WHERE pelada_id IS NULL"), {"pelada_id": pelada_id})
    db.execute(text("UPDATE matches SET pelada_id = :pelada_id WHERE pelada_id IS NULL"), {"pelada_id": pelada_id})
    db.execute(text("UPDATE match_teams SET pelada_id = :pelada_id WHERE pelada_id IS NULL"), {"pelada_id": pelada_id})
    db.execute(text("UPDATE match_players SET pelada_id = :pelada_id WHERE pelada_id IS NULL"), {"pelada_id": pelada_id})
    db.commit()
