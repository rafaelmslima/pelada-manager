import unittest
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app import crud, models, schemas
from app.auth import _get_user_from_token
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

    def test_expired_session_is_rejected_and_removed(self):
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        Base.metadata.create_all(bind=engine)

        db = SessionLocal()
        try:
            user = models.User(email="a@example.com", password_hash="x")
            db.add(user)
            db.flush()
            db.add(models.Pelada(name="A", owner_user_id=user.id))
            db.add(
                models.UserSession(
                    user_id=user.id,
                    token="expired-token",
                    created_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(seconds=120),
                )
            )
            db.commit()

            with patch.dict("os.environ", {"SESSION_MAX_AGE_SECONDS": "60"}):
                self.assertIsNone(_get_user_from_token(db, "expired-token"))

            remaining = db.scalars(
                select(models.UserSession).where(models.UserSession.token == "expired-token")
            ).first()
            self.assertIsNone(remaining)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
