import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import crud, models, schemas
from app.database import Base


class AuthMultitenantTest(unittest.TestCase):
    def test_isolates_players_between_peladas(self):
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        Base.metadata.create_all(bind=engine)

        db = SessionLocal()
        try:
            user_a = models.User(email="a@example.com", password_hash="x")
            user_b = models.User(email="b@example.com", password_hash="x")
            db.add_all([user_a, user_b])
            db.flush()

            pelada_a = models.Pelada(name="A", owner_user_id=user_a.id)
            pelada_b = models.Pelada(name="B", owner_user_id=user_b.id)
            db.add_all([pelada_a, pelada_b])
            db.commit()

            crud.create_player(
                db,
                schemas.PlayerCreate(name="Jogador A", position="meio", rating=4, is_active=True),
                pelada_a.id,
            )

            players_a = crud.get_players(db, pelada_a.id)
            players_b = crud.get_players(db, pelada_b.id)

            self.assertEqual(len(players_a), 1)
            self.assertEqual(players_a[0].name, "Jogador A")
            self.assertEqual(players_b, [])
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
