from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


Position = Literal["defesa", "meio", "ataque"]
BillingType = Literal["mensalista", "diarista"]


class AuthRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: str
    password: str = Field(..., min_length=6, max_length=128)
    pelada_name: str | None = Field(default=None, min_length=2, max_length=120)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        clean = value.strip().lower()
        if "@" not in clean:
            raise ValueError("Email invalido.")
        return clean


class AuthLoginRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        clean = value.strip().lower()
        if "@" not in clean:
            raise ValueError("Email invalido.")
        return clean


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    created_at: datetime


class PeladaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: datetime


class AuthMeResponse(BaseModel):
    user: UserRead
    pelada: PeladaRead
    server_time: datetime


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


class MatchCreate(BaseModel):
    date: date
    title: str = Field(..., min_length=1, max_length=120)
    teams: list[MatchTeamCreate] = Field(..., min_length=1)


class MatchStatsPlayerUpdate(BaseModel):
    id: int
    goals: int = Field(..., ge=0)
    assists: int = Field(..., ge=0)


class MatchStatsUpdate(BaseModel):
    team_of_the_week_id: int | None = None
    players: list[MatchStatsPlayerUpdate]


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
