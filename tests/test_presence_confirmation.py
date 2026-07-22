import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import crud, models, schemas
from app.database import Base


def _new_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)()


def _make_pelada(db):
    user = models.User(email="a@example.com", password_hash="x")
    db.add(user)
    db.flush()
    pelada = models.Pelada(name="Pelada A", location="Quadra", match_time="20:00", owner_user_id=user.id)
    db.add(pelada)
    db.commit()
    return pelada


class PresenceConfirmationTest(unittest.TestCase):
    def test_new_player_starts_pending(self):
        db = _new_session()
        try:
            pelada = _make_pelada(db)
            player = crud.create_player(
                db, schemas.PlayerCreate(name="Jo", position="meio", rating=3, is_active=False), pelada.id
            )
            self.assertEqual(player.presence, "pending")
            self.assertFalse(player.is_active)

            active = crud.create_player(
                db, schemas.PlayerCreate(name="Ze", position="ataque", rating=4, is_active=True), pelada.id
            )
            self.assertEqual(active.presence, "confirmed")
        finally:
            db.close()

    def test_confirmation_token_is_created_and_idempotent(self):
        db = _new_session()
        try:
            pelada = _make_pelada(db)
            token = crud.ensure_confirmation_token(db, pelada)
            self.assertTrue(token)
            self.assertEqual(crud.ensure_confirmation_token(db, pelada), token)
            self.assertEqual(crud.get_pelada_by_token(db, token).id, pelada.id)

            rotated = crud.rotate_confirmation_token(db, pelada)
            self.assertNotEqual(rotated, token)
            self.assertIsNone(crud.get_pelada_by_token(db, token))
        finally:
            db.close()

    def test_set_presence_syncs_is_active(self):
        db = _new_session()
        try:
            pelada = _make_pelada(db)
            player = crud.create_player(
                db, schemas.PlayerCreate(name="Jo", position="meio", rating=3, is_active=False), pelada.id
            )

            crud.set_player_presence(db, pelada, player.id, "confirmed")
            db.refresh(player)
            self.assertTrue(player.is_active)
            self.assertEqual(player.presence, "confirmed")

            crud.set_player_presence(db, pelada, player.id, "declined")
            db.refresh(player)
            self.assertFalse(player.is_active)
            self.assertEqual(player.presence, "declined")
        finally:
            db.close()

    def test_set_presence_rejects_player_from_other_pelada(self):
        db = _new_session()
        try:
            pelada = _make_pelada(db)
            with self.assertRaises(ValueError):
                crud.set_player_presence(db, pelada, 9999, "confirmed")
        finally:
            db.close()

    def test_deactivate_all_resets_presence_to_pending(self):
        db = _new_session()
        try:
            pelada = _make_pelada(db)
            p1 = crud.create_player(
                db, schemas.PlayerCreate(name="A", position="meio", rating=3, is_active=True), pelada.id
            )
            crud.set_player_presence(db, pelada, p1.id, "declined")

            crud.deactivate_all_players(db, pelada.id)
            db.refresh(p1)
            self.assertFalse(p1.is_active)
            self.assertEqual(p1.presence, "pending")
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
