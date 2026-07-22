import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import auth, crud, models, schemas
from app.database import Base


def _new_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)()


def _register(db, email):
    return auth.register_user(
        db, schemas.AuthRegisterRequest(name="User", email=email, password="secret1", pelada_name="Pelada Um")
    )


class MultiPeladaTest(unittest.TestCase):
    def test_register_creates_owner_membership_and_active(self):
        db = _new_session()
        try:
            user = _register(db, "a@example.com")
            self.assertIsNotNone(user.active_pelada_id)
            peladas = crud.get_user_peladas(db, user)
            self.assertEqual(len(peladas), 1)
            self.assertEqual(peladas[0][1], "owner")
            self.assertEqual(auth.get_current_pelada(user).id, user.active_pelada_id)
        finally:
            db.close()

    def test_create_second_pelada_switches_active(self):
        db = _new_session()
        try:
            user = _register(db, "a@example.com")
            first = user.active_pelada_id
            crud.create_pelada_for_user(db, user, "Segunda", "", "20:00")
            db.refresh(user)
            self.assertNotEqual(user.active_pelada_id, first)
            self.assertEqual(len(crud.get_user_peladas(db, user)), 2)

            # volta para a primeira
            crud.select_pelada(db, user, first)
            db.refresh(user)
            self.assertEqual(user.active_pelada_id, first)
        finally:
            db.close()

    def test_select_rejects_pelada_without_access(self):
        db = _new_session()
        try:
            user_a = _register(db, "a@example.com")
            user_b = _register(db, "b@example.com")
            with self.assertRaises(ValueError):
                crud.select_pelada(db, user_a, user_b.active_pelada_id)
        finally:
            db.close()

    def test_join_by_invite_code_adds_membership(self):
        db = _new_session()
        try:
            owner = _register(db, "owner@example.com")
            owner_pelada = auth.get_current_pelada(owner)
            code = crud.ensure_invite_code(db, owner_pelada)

            guest = _register(db, "guest@example.com")
            joined = crud.join_pelada_by_code(db, guest, code)
            db.refresh(guest)

            self.assertEqual(joined.id, owner_pelada.id)
            self.assertEqual(guest.active_pelada_id, owner_pelada.id)
            self.assertTrue(crud.user_can_access_pelada(guest, owner_pelada.id))
            # guest agora tem 2 peladas (a propria + a que entrou)
            self.assertEqual(len(crud.get_user_peladas(db, guest)), 2)
        finally:
            db.close()

    def test_join_invalid_code(self):
        db = _new_session()
        try:
            user = _register(db, "a@example.com")
            with self.assertRaises(ValueError):
                crud.join_pelada_by_code(db, user, "nao-existe")
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
