from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


Position = Literal["defesa", "meio", "ataque"]
BillingType = Literal["mensalista", "diarista"]
PresenceStatus = Literal["pending", "confirmed", "declined"]


class AuthRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    pelada_name: str | None = Field(default=None, min_length=2, max_length=120)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class AuthLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class AdminPasswordResetRequest(BaseModel):
    email: EmailStr
    new_password: str = Field(..., min_length=6, max_length=128)
    admin_secret: str = Field(..., min_length=1, max_length=512)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class AdminPasswordResetResponse(BaseModel):
    ok: bool


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    created_at: datetime


class PeladaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    location: str
    match_time: str
    default_billing_type: BillingType
    daily_fee: float = 0
    created_at: datetime


class PeladaUpdate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    location: str = Field(default="", max_length=160)
    match_time: str = Field(default="20:00", pattern=r"^\d{2}:\d{2}$")
    default_billing_type: BillingType = "diarista"

    @field_validator("name", "location", "match_time")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class PeladaCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    location: str = Field(default="", max_length=160)
    match_time: str = Field(default="20:00", pattern=r"^\d{2}:\d{2}$")

    @field_validator("name", "location")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class PeladaMembershipRead(BaseModel):
    id: int
    name: str
    location: str
    match_time: str
    role: str
    is_active: bool


class JoinPeladaRequest(BaseModel):
    invite_code: str = Field(..., min_length=1, max_length=20)


class InviteCodeResponse(BaseModel):
    invite_code: str


class AuthMeResponse(BaseModel):
    user: UserRead
    pelada: PeladaRead
    server_time: datetime
    # Preenchido apenas no login/register para o app mobile (Bearer token).
    # A web ignora este campo e continua usando o cookie de sessao.
    token: str | None = None


class PlayerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    position: Position
    rating: float = Field(..., ge=0, le=5)
    billing_type: BillingType = "diarista"
    has_paid: bool = False
    whatsapp: str = Field(default="", max_length=30)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        clean_value = value.strip()
        if not clean_value:
            raise ValueError("Nome e obrigatorio.")
        return clean_value

    @field_validator("whatsapp")
    @classmethod
    def normalize_whatsapp(cls, value: str) -> str:
        return value.strip()


class PlayerCreate(PlayerBase):
    is_active: bool = False


class PlayerUpdate(PlayerBase):
    is_active: bool = False


class PlayerRead(PlayerBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    presence: PresenceStatus = "pending"
    created_at: datetime


class TeamGenerateRequest(BaseModel):
    players_per_team: int = Field(..., ge=1, le=30)


class TeamPlayer(BaseModel):
    id: int
    name: str
    position: Position
    rating: float


class TeamResult(BaseModel):
    name: str
    total_rating: float
    average_rating: float
    player_count: int
    capacity: int
    is_incomplete: bool
    players: list[TeamPlayer]


class TeamGenerateResponse(BaseModel):
    players_per_team: int
    selected_count: int
    team_count: int
    teams: list[TeamResult]
    reserves: list[TeamPlayer]


class MatchPlayerCreate(BaseModel):
    player_id: int
    goals: int = Field(default=0, ge=0)
    assists: int = Field(default=0, ge=0)


class MatchTeamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    total_rating: float = Field(default=0, ge=0)
    is_team_of_the_week: bool = False
    players: list[MatchPlayerCreate] = Field(..., min_length=1)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        clean_value = value.strip()
        if not clean_value:
            raise ValueError("Nome do time e obrigatorio.")
        return clean_value


class MatchCreate(BaseModel):
    date: date
    title: str = Field(..., min_length=1, max_length=120)
    teams: list[MatchTeamCreate] = Field(..., min_length=1)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        clean_value = value.strip()
        if not clean_value:
            raise ValueError("Titulo da pelada e obrigatorio.")
        return clean_value


class MatchStatsPlayerUpdate(BaseModel):
    id: int
    goals: int = Field(..., ge=0)
    assists: int = Field(..., ge=0)


class MatchStatsUpdate(BaseModel):
    team_of_the_week_id: int | None = None
    players: list[MatchStatsPlayerUpdate]


class MatchPlayerEvent(BaseModel):
    # Placar ao vivo: variacao de gols/assistencias (aceita negativo para desfazer).
    goals_delta: int = Field(default=0, ge=-20, le=20)
    assists_delta: int = Field(default=0, ge=-20, le=20)


class MatchRatingItem(BaseModel):
    player_id: int
    score: float = Field(..., ge=0, le=5)


class MatchRatingsUpdate(BaseModel):
    ratings: list[MatchRatingItem]


class MatchRatingRead(BaseModel):
    player_id: int
    score: float


class MatchPlayerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    match_id: int
    team_id: int
    player_id: int
    goals: int
    assists: int
    was_in_team_of_the_week: bool
    player: TeamPlayer


class MatchTeamRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    match_id: int
    name: str
    total_rating: float
    is_team_of_the_week: bool
    players: list[MatchPlayerRead]


class MatchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: date
    title: str
    created_at: datetime
    teams: list[MatchTeamRead]


class MatchListItem(BaseModel):
    id: int
    date: date
    title: str
    created_at: datetime
    team_count: int
    player_count: int


class PlayerMatchHistoryItem(BaseModel):
    match_id: int
    date: date
    title: str
    team_name: str
    goals: int
    assists: int
    was_in_team_of_the_week: bool


class PlayerProfile(BaseModel):
    player: PlayerRead
    total_matches: int
    total_goals: int
    total_assists: int
    average_goals: float
    average_assists: float
    team_of_the_week_count: int
    history: list[PlayerMatchHistoryItem]


class RankingPlayer(BaseModel):
    player_id: int
    name: str
    position: Position
    rating: float
    matches_played: int
    goals: int
    assists: int
    goals_per_match: float
    assists_per_match: float


class RankingResponse(BaseModel):
    ranking_type: Literal["scorers", "assists"]
    players: list[RankingPlayer]


class RankingsSummary(BaseModel):
    scorers: RankingResponse
    assists: RankingResponse


# --- Confirmacao de presenca (link publico) ---


class ConfirmationLinkResponse(BaseModel):
    token: str
    path: str


class PublicConfirmationPlayer(BaseModel):
    id: int
    name: str
    position: Position
    presence: PresenceStatus


class PublicConfirmationView(BaseModel):
    pelada_name: str
    location: str
    match_time: str
    confirmed_count: int
    declined_count: int
    total: int
    players: list[PublicConfirmationPlayer]


class PublicPresenceUpdate(BaseModel):
    status: PresenceStatus


# --- Push notifications ---


class DeviceTokenRegister(BaseModel):
    token: str = Field(..., min_length=1, max_length=255)
    platform: str = Field(default="", max_length=20)


class DeviceTokenDelete(BaseModel):
    token: str = Field(..., min_length=1, max_length=255)


class OkResponse(BaseModel):
    ok: bool


# --- Financeiro ---

FinanceKind = Literal["income", "expense"]


class FinanceSettingsUpdate(BaseModel):
    daily_fee: float = Field(..., ge=0, le=100000)


class FinanceEntryCreate(BaseModel):
    kind: FinanceKind
    amount: float = Field(..., gt=0, le=1000000)
    description: str = Field(default="", max_length=160)
    player_id: int | None = None

    @field_validator("description")
    @classmethod
    def strip_description(cls, value: str) -> str:
        return value.strip()


class FinanceEntryRead(BaseModel):
    id: int
    kind: FinanceKind
    amount: float
    description: str
    player_id: int | None
    player_name: str | None
    created_at: datetime


class MensalistaStatus(BaseModel):
    player_id: int
    name: str
    has_paid: bool


class FinanceOverview(BaseModel):
    daily_fee: float
    total_income: float
    total_expense: float
    balance: float
    mensalistas: list[MensalistaStatus]
    entries: list[FinanceEntryRead]
