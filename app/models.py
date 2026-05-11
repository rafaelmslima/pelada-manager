from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    pelada: Mapped["Pelada"] = relationship(back_populates="owner", uselist=False)
    sessions: Mapped[list["UserSession"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship(back_populates="sessions")


class Pelada(Base):
    __tablename__ = "peladas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    location: Mapped[str] = mapped_column(String(160), default="", nullable=False)
    match_time: Mapped[str] = mapped_column(String(20), default="20:00", nullable=False)
    default_billing_type: Mapped[str] = mapped_column(String(20), default="diarista", nullable=False)
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    owner: Mapped["User"] = relationship(back_populates="pelada")
    players: Mapped[list["Player"]] = relationship(back_populates="pelada", cascade="all, delete-orphan")
    matches: Mapped[list["Match"]] = relationship(back_populates="pelada", cascade="all, delete-orphan")


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pelada_id: Mapped[int] = mapped_column(ForeignKey("peladas.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    position: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    rating: Mapped[float] = mapped_column(Float, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    billing_type: Mapped[str] = mapped_column(String(20), default="diarista", nullable=False)
    has_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    whatsapp: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    pelada: Mapped["Pelada"] = relationship(back_populates="players")
    match_entries: Mapped[list["MatchPlayer"]] = relationship(back_populates="player")


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pelada_id: Mapped[int] = mapped_column(ForeignKey("peladas.id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    pelada: Mapped["Pelada"] = relationship(back_populates="matches")
    teams: Mapped[list["MatchTeam"]] = relationship(
        back_populates="match",
        cascade="all, delete-orphan",
    )
    players: Mapped[list["MatchPlayer"]] = relationship(
        back_populates="match",
        cascade="all, delete-orphan",
    )


class MatchTeam(Base):
    __tablename__ = "match_teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pelada_id: Mapped[int] = mapped_column(ForeignKey("peladas.id"), nullable=False, index=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    total_rating: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    is_team_of_the_week: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    match: Mapped["Match"] = relationship(back_populates="teams")
    players: Mapped[list["MatchPlayer"]] = relationship(
        back_populates="team",
        cascade="all, delete-orphan",
    )


class MatchPlayer(Base):
    __tablename__ = "match_players"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pelada_id: Mapped[int] = mapped_column(ForeignKey("peladas.id"), nullable=False, index=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), nullable=False, index=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("match_teams.id"), nullable=False, index=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False, index=True)
    goals: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    assists: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    was_in_team_of_the_week: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    match: Mapped["Match"] = relationship(back_populates="players")
    team: Mapped["MatchTeam"] = relationship(back_populates="players")
    player: Mapped["Player"] = relationship(back_populates="match_entries")
