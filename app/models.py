from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # Plano do usuario: "free" | "premium".
    plan: Mapped[str] = mapped_column(String(20), default="free", nullable=False)
    # Pelada atualmente selecionada (multi-pelada). Sem FK para evitar ciclo users<->peladas.
    active_pelada_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    owned_peladas: Mapped[list["Pelada"]] = relationship(
        back_populates="owner", foreign_keys="Pelada.owner_user_id"
    )
    memberships: Mapped[list["PeladaMember"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    active_pelada: Mapped["Pelada | None"] = relationship(
        "Pelada",
        primaryjoin="foreign(User.active_pelada_id) == Pelada.id",
        viewonly=True,
        uselist=False,
    )
    sessions: Mapped[list["UserSession"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    user: Mapped["User"] = relationship(back_populates="sessions")


class PeladaMember(Base):
    __tablename__ = "pelada_members"
    __table_args__ = (UniqueConstraint("user_id", "pelada_id", name="uq_pelada_member"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    pelada_id: Mapped[int] = mapped_column(ForeignKey("peladas.id"), nullable=False, index=True)
    # "owner" | "member".
    role: Mapped[str] = mapped_column(String(20), default="member", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    user: Mapped["User"] = relationship(back_populates="memberships")
    pelada: Mapped["Pelada"] = relationship(back_populates="members")


class DeviceToken(Base):
    __tablename__ = "device_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    # Expo push token do device (ex.: "ExponentPushToken[...]").
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    platform: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    user: Mapped["User"] = relationship()


class Pelada(Base):
    __tablename__ = "peladas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    location: Mapped[str] = mapped_column(String(160), default="", nullable=False)
    match_time: Mapped[str] = mapped_column(String(20), default="20:00", nullable=False)
    default_billing_type: Mapped[str] = mapped_column(String(20), default="diarista", nullable=False)
    # Valor da diaria (cobranca por pelada). 0 = nao configurado.
    daily_fee: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    # Mensalidade e dia de vencimento (1-28).
    monthly_fee: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    monthly_due_day: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    # Token do link publico de confirmacao de presenca (gerado sob demanda).
    public_token: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True, index=True)
    # Codigo de convite para outros usuarios entrarem na pelada.
    invite_code: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True, index=True)
    # Um usuario pode ter varias peladas (unique removido).
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    owner: Mapped["User"] = relationship(back_populates="owned_peladas", foreign_keys=[owner_user_id])
    members: Mapped[list["PeladaMember"]] = relationship(
        back_populates="pelada", cascade="all, delete-orphan"
    )
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
    # Status de presenca: "pending" | "confirmed" | "declined". is_active fica em sincronia
    # (confirmed => True). Permite distinguir "recusou" de "ainda nao respondeu".
    presence: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    billing_type: Mapped[str] = mapped_column(String(20), default="diarista", nullable=False)
    has_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Mes ("YYYY-MM") pelo qual o mensalista esta pago. None/mes diferente = pendente.
    paid_month: Mapped[str | None] = mapped_column(String(7), nullable=True)
    whatsapp: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    pelada: Mapped["Pelada"] = relationship(back_populates="players")
    match_entries: Mapped[list["MatchPlayer"]] = relationship(back_populates="player")


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pelada_id: Mapped[int] = mapped_column(ForeignKey("peladas.id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

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


class FinanceEntry(Base):
    __tablename__ = "finance_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pelada_id: Mapped[int] = mapped_column(ForeignKey("peladas.id"), nullable=False, index=True)
    # "income" (entrada) | "expense" (saida).
    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(String(160), default="", nullable=False)
    # Jogador associado (ex.: quem pagou a diaria); opcional.
    player_id: Mapped[int | None] = mapped_column(ForeignKey("players.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    player: Mapped["Player | None"] = relationship()


class MatchRound(Base):
    """Um confronto (Time A x Time B) dentro de uma pelada — rodizio de times."""

    __tablename__ = "match_rounds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pelada_id: Mapped[int] = mapped_column(ForeignKey("peladas.id"), nullable=False, index=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), nullable=False, index=True)
    team_a_id: Mapped[int] = mapped_column(ForeignKey("match_teams.id"), nullable=False)
    team_b_id: Mapped[int] = mapped_column(ForeignKey("match_teams.id"), nullable=False)
    goals_a: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    goals_b: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    stats: Mapped[list["RoundPlayerStat"]] = relationship(
        back_populates="round", cascade="all, delete-orphan"
    )


class RoundPlayerStat(Base):
    """Gols/assistencias de um jogador num confronto especifico."""

    __tablename__ = "round_player_stats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pelada_id: Mapped[int] = mapped_column(ForeignKey("peladas.id"), nullable=False, index=True)
    round_id: Mapped[int] = mapped_column(ForeignKey("match_rounds.id"), nullable=False, index=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False, index=True)
    goals: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    assists: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    round: Mapped["MatchRound"] = relationship(back_populates="stats")


class PlayerRating(Base):
    __tablename__ = "player_ratings"
    __table_args__ = (UniqueConstraint("match_id", "player_id", name="uq_player_rating_match_player"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pelada_id: Mapped[int] = mapped_column(ForeignKey("peladas.id"), nullable=False, index=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), nullable=False, index=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False, index=True)
    # Nota atribuida ao jogador naquela pelada (0 a 5).
    score: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
