from datetime import date
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import crud, models, schemas
from app.database import Base


class MatchIntegrityTest(unittest.TestCase):
    def test_rejects_duplicate_stat_rows(self):
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        Base.metadata.create_all(bind=engine)

        db = SessionLocal()
        try:
            user = models.User(email="a@example.com", password_hash="x")
            db.add(user)
            db.flush()
            pelada = models.Pelada(name="A", owner_user_id=user.id)
            db.add(pelada)
            db.flush()
            player = crud.create_player(
                db,
                schemas.PlayerCreate(name="Jogador A", position="meio", rating=4, is_active=True),
                pelada.id,
            )

            match = crud.create_match(
                db,
                schemas.MatchCreate(
                    date=date(2026, 5, 17),
                    title="Pelada teste",
                    teams=[
                        schemas.MatchTeamCreate(
                            name="Time 1",
                            players=[schemas.MatchPlayerCreate(player_id=player.id)],
                        )
                    ],
                ),
                pelada.id,
            )
            match_player_id = match.teams[0].players[0].id

            with self.assertRaisesRegex(ValueError, "mais de uma vez"):
                crud.update_match_stats(
                    db,
                    match,
                    schemas.MatchStatsUpdate(
                        players=[
                            schemas.MatchStatsPlayerUpdate(id=match_player_id, goals=1, assists=0),
                            schemas.MatchStatsPlayerUpdate(id=match_player_id, goals=2, assists=1),
                        ]
                    ),
                    pelada.id,
                )
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
