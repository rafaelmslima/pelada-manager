import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import crud, models, schemas
from app.database import Base


def _new_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)()


def _pelada_with_match(db):
    user = models.User(email="a@example.com", password_hash="x")
    db.add(user)
    db.flush()
    pelada = models.Pelada(name="Pelada A", owner_user_id=user.id)
    db.add(pelada)
    db.commit()

    p1 = crud.create_player(db, schemas.PlayerCreate(name="A", position="meio", rating=3, is_active=True), pelada.id)
    p2 = crud.create_player(db, schemas.PlayerCreate(name="B", position="ataque", rating=3, is_active=True), pelada.id)

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
    return pelada, match, p1, p2


class LiveScoreTest(unittest.TestCase):
    def test_increment_and_clamp(self):
        db = _new_session()
        try:
            pelada, match, p1, _ = _pelada_with_match(db)
            mp = next(mp for mp in match.players if mp.player_id == p1.id)

            crud.increment_match_player_stats(db, match, mp.id, goals_delta=2, assists_delta=1, pelada_id=pelada.id)
            db.refresh(mp)
            self.assertEqual((mp.goals, mp.assists), (2, 1))

            # Nao fica negativo.
            crud.increment_match_player_stats(db, match, mp.id, goals_delta=-5, assists_delta=0, pelada_id=pelada.id)
            db.refresh(mp)
            self.assertEqual(mp.goals, 0)
        finally:
            db.close()

    def test_increment_rejects_foreign_match_player(self):
        db = _new_session()
        try:
            pelada, match, _, _ = _pelada_with_match(db)
            with self.assertRaises(ValueError):
                crud.increment_match_player_stats(db, match, 9999, 1, 0, pelada.id)
        finally:
            db.close()


class RatingsLoopTest(unittest.TestCase):
    def test_ratings_feed_player_rating_average(self):
        db = _new_session()
        try:
            pelada, match, p1, p2 = _pelada_with_match(db)

            crud.save_match_ratings(db, match, [(p1.id, 5.0), (p2.id, 2.0)], pelada.id)
            db.refresh(p1)
            db.refresh(p2)
            self.assertEqual(p1.rating, 5.0)
            self.assertEqual(p2.rating, 2.0)

            # Segunda pelada com nota diferente -> media.
            match2 = crud.create_match(
                db,
                schemas.MatchCreate(
                    date="2026-07-29",
                    title="Pelada 2",
                    teams=[schemas.MatchTeamCreate(name="T", players=[schemas.MatchPlayerCreate(player_id=p1.id)])],
                ),
                pelada.id,
            )
            crud.save_match_ratings(db, match2, [(p1.id, 3.0)], pelada.id)
            db.refresh(p1)
            self.assertEqual(p1.rating, 4.0)  # media de 5 e 3
        finally:
            db.close()

    def test_ratings_upsert_same_match(self):
        db = _new_session()
        try:
            pelada, match, p1, _ = _pelada_with_match(db)
            crud.save_match_ratings(db, match, [(p1.id, 5.0)], pelada.id)
            crud.save_match_ratings(db, match, [(p1.id, 1.0)], pelada.id)  # sobrescreve a nota da mesma pelada
            db.refresh(p1)
            self.assertEqual(p1.rating, 1.0)
            self.assertEqual(crud.get_match_ratings(db, match.id, pelada.id), {p1.id: 1.0})
        finally:
            db.close()

    def test_rating_rejects_non_participant(self):
        db = _new_session()
        try:
            pelada, match, _, _ = _pelada_with_match(db)
            outsider = crud.create_player(
                db, schemas.PlayerCreate(name="Fora", position="meio", rating=3, is_active=False), pelada.id
            )
            with self.assertRaises(ValueError):
                crud.save_match_ratings(db, match, [(outsider.id, 4.0)], pelada.id)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
