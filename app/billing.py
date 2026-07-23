"""Regras de plano free/premium (freemium)."""

from __future__ import annotations

import os

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app import models


# Limites do plano gratuito. Premium = ilimitado.
FREE_MAX_PELADAS = 1
FREE_MAX_PLAYERS = 40


def is_premium(user: models.User) -> bool:
    return getattr(user, "plan", "free") == "premium"


def limits_for(user: models.User) -> dict:
    if is_premium(user):
        return {"max_peladas": None, "max_players": None}
    return {"max_peladas": FREE_MAX_PELADAS, "max_players": FREE_MAX_PLAYERS}


def _premium_error(detail: str) -> HTTPException:
    # 402 Payment Required: o app trata isso como "abrir tela Premium".
    return HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=detail)


def require_pelada_quota(user: models.User) -> None:
    if is_premium(user):
        return
    if len(user.owned_peladas) >= FREE_MAX_PELADAS:
        raise _premium_error("O plano gratuito permite 1 pelada. Assine o Premium para gerenciar várias.")


def require_player_quota(user: models.User, current_count: int) -> None:
    if is_premium(user):
        return
    if current_count >= FREE_MAX_PLAYERS:
        raise _premium_error(f"O plano gratuito permite até {FREE_MAX_PLAYERS} jogadores. Assine o Premium.")


def activate_premium(db: Session, user: models.User, code: str) -> None:
    expected = os.getenv("PREMIUM_ACTIVATION_CODE", "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ativação por código não configurada.",
        )
    if code.strip() != expected:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Código inválido.")
    user.plan = "premium"
    db.commit()
