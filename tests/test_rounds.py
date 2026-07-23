import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import crud, models, schemas
from app.database import Base


def _new_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)()


def _pelada_with_teams(db):
    user = models.User(email="a@example.com", password_hash="x")
    db.add(user)
    db.flush()
    pelada = models.Pelada(name="P", owner_user_id=user.id)
    db.add(pelada)
    db.commit()

    p1 = crud.create_player(db, schemas.PlayerCreate(name="A1", position="meio", rating=3, is_active=True), pelada.id)
    p2 = crud.create_player(db, schemas.PlayerCreate(name="B1", position="ataque", rating=3, is_active=True), pelada.id)
    match = crud.create_match(
        db,
        schemas.MatchCreate(
            date="2026-07-22",
            title="Pelada",
            teams=[
                schemas.MatchTeamCreate(name="Time 1", players=[schemas.MatchPlayerCreate(player_id=p1.id)]),
                schemas.MatchTeamCreate(name="Time 2", players=[schemas.MatchPlayerCreate(player_id=p2.id)]),
            ],
        ),
        pelada.id,
    )
    team_a, team_b = match.teams[0], match.teams[1]
    return pelada, match, team_a, team_b, p1, p2


class RoundsTest(unittest.TestCase):
    def test_create_round_updates_player_totals_and_standings(self):
        db = _new_session()
        try:
            pelada, match, team_a, team_b, p1, p2 = _pelada_with_teams(db)
            crud.create_round(
                db,
                match,
                schemas.RoundCreate(
                    team_a_id=team_a.id,
                    team_b_id=team_b.id,
                    goals_a=2,
                    goals_b=1,
                    duration_seconds=600,
                    stats=[
                        schemas.RoundPlayerStatInput(player_id=p1.id, goals=2, assists=0),
                        schemas.RoundPlayerStatInput(player_id=p2.id, goals=1, assists=0),
                    ],
                ),
                pelada.id,
            )
            match = crud.get_match(db, match.id, pelada.id)
            overview = crud.get_rounds_overview(db, match, pelada.id)

            self.assertEqual(len(overview.rounds), 1)
            self.assertEqual((overview.rounds[0].goals_a, overview.rounds[0].goals_b), (2, 1))
            # Time A venceu -> 3 pontos e lidera
            self.assertEqual(overview.standings[0].team_id, team_a.id)
            self.assertEqual(overview.standings[0].points, 3)
            self.assertEqual(overview.champion.team_id, team_a.id)
            # Artilheiro do dia = p1 com 2 gols
            self.assertEqual(overview.top_scorer.player_id, p1.id)
            self.assertEqual(overview.top_scorer.goals, 2)
            # Totais do jogador atualizados (feed ranking)
            mp1 = next(mp for mp in match.players if mp.player_id == p1.id)
            self.assertEqual(mp1.goals, 2)
        finally:
            db.close()

    def test_draw_gives_one_point_each(self):
        db = _new_session()
        try:
            pelada, match, team_a, team_b, p1, p2 = _pelada_with_teams(db)
            crud.create_round(
                db,
                match,
                schemas.RoundCreate(team_a_id=team_a.id, team_b_id=team_b.id, goals_a=1, goals_b=1),
                pelada.id,
            )
            match = crud.get_match(db, match.id, pelada.id)
            overview = crud.get_rounds_overview(db, match, pelada.id)
            self.assertTrue(all(s.points == 1 and s.draws == 1 for s in overview.standings))
        finally:
            db.close()

    def test_wins_credited_to_winning_roster_and_profile(self):
        db = _new_session()
        try:
            pelada, match, team_a, team_b, p1, p2 = _pelada_with_teams(db)
            crud.create_round(
                db,
                match,
                schemas.RoundCreate(
                    team_a_id=team_a.id,
                    team_b_id=team_b.id,
                    goals_a=3,
                    goals_b=1,
                    team_a_players=[p1.id],
                    team_b_players=[p2.id],
                ),
                pelada.id,
            )
            match = crud.get_match(db, match.id, pelada.id)
            mp1 = next(mp for mp in match.players if mp.player_id == p1.id)
            mp2 = next(mp for mp in match.players if mp.player_id == p2.id)
            self.assertEqual(mp1.wins, 1)  # venceu
            self.assertEqual(mp2.wins, 0)  # perdeu
            self.assertEqual(crud.get_player_profile(db, p1, pelada.id).total_wins, 1)
        finally:
            db.close()

    def test_delete_match_rounds_keeps_player_aggregates(self):
        db = _new_session()
        try:
            pelada, match, team_a, team_b, p1, p2 = _pelada_with_teams(db)
            crud.create_round(
                db,
                match,
                schemas.RoundCreate(
                    team_a_id=team_a.id,
                    team_b_id=team_b.id,
                    goals_a=2,
                    goals_b=0,
                    stats=[schemas.RoundPlayerStatInput(player_id=p1.id, goals=2)],
                    team_a_players=[p1.id],
                    team_b_players=[p2.id],
                ),
                pelada.id,
            )
            match = crud.get_match(db, match.id, pelada.id)
            crud.delete_match_rounds(db, match)
            match = crud.get_match(db, match.id, pelada.id)
            overview = crud.get_rounds_overview(db, match, pelada.id)
            self.assertEqual(len(overview.rounds), 0)  # confrontos apagados
            self.assertIsNone(match.live_state)
            # Agregados do jogador preservados (gols e vitória)
            profile = crud.get_player_profile(db, p1, pelada.id)
            self.assertEqual(profile.total_goals, 2)
            self.assertEqual(profile.total_wins, 1)
        finally:
            db.close()

    def test_round_rejects_same_team(self):
        db = _new_session()
        try:
            pelada, match, team_a, _team_b, _p1, _p2 = _pelada_with_teams(db)
            with self.assertRaises(ValueError):
                crud.create_round(
                    db, match, schemas.RoundCreate(team_a_id=team_a.id, team_b_id=team_a.id), pelada.id
                )
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
