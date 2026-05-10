from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.auth import get_current_pelada, require_user
from app.database import get_db
from app.services.team_balancer import generate_balanced_teams


router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.post("/generate", response_model=schemas.TeamGenerateResponse)
def generate_teams(
    request: schemas.TeamGenerateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_user),
):
    pelada = get_current_pelada(current_user)
    active_players = crud.get_active_players(db, pelada.id)
    if not active_players:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selecione ao menos um jogador para gerar os times.",
        )

    teams, reserves = generate_balanced_teams(active_players, request.players_per_team)

    return schemas.TeamGenerateResponse(
        players_per_team=request.players_per_team,
        selected_count=len(active_players),
        team_count=len(teams),
        teams=[
            schemas.TeamResult(
                name=team.name,
                total_rating=team.total_rating,
                average_rating=team.average_rating,
                player_count=len(team.players),
                capacity=team.capacity,
                is_incomplete=len(team.players) < request.players_per_team,
                players=[_serialize_player(player) for player in team.players],
            )
            for team in teams
        ],
        reserves=[_serialize_player(player) for player in reserves],
    )


def _serialize_player(player) -> schemas.TeamPlayer:
    return schemas.TeamPlayer(
        id=player.id,
        name=player.name,
        position=player.position,
        rating=player.rating,
    )
