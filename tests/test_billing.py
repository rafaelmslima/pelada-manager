import unittest
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import auth, billing, crud, models, schemas
from app.database import Base


def _new_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)()


def _register(db, email="a@example.com"):
    return auth.register_user(
        db, schemas.AuthRegisterRequest(name="User", email=email, password="secret1", pelada_name="Pelada")
    )


class BillingTest(unittest.TestCase):
    def test_free_user_blocked_from_second_pelada(self):
        db = _new_session()
        try:
            user = _register(db)
            with self.assertRaises(HTTPException) as ctx:
                billing.require_pelada_quota(user)
            self.assertEqual(ctx.exception.status_code, 402)
        finally:
            db.close()

    def test_premium_user_allowed_more_peladas(self):
        db = _new_session()
        try:
            user = _register(db)
            user.plan = "premium"
            db.commit()
            billing.require_pelada_quota(user)  # nao levanta
            self.assertIsNone(billing.limits_for(user)["max_peladas"])
        finally:
            db.close()

    def test_player_quota(self):
        db = _new_session()
        try:
            user = _register(db)
            billing.require_player_quota(user, billing.FREE_MAX_PLAYERS - 1)  # ok
            with self.assertRaises(HTTPException) as ctx:
                billing.require_player_quota(user, billing.FREE_MAX_PLAYERS)
            self.assertEqual(ctx.exception.status_code, 402)
        finally:
            db.close()

    def test_activate_premium_with_code(self):
        db = _new_session()
        try:
            user = _register(db)
            with patch.dict("os.environ", {"PREMIUM_ACTIVATION_CODE": "GOLACO"}):
                with self.assertRaises(HTTPException):
                    billing.activate_premium(db, user, "errado")
                billing.activate_premium(db, user, "GOLACO")
            db.refresh(user)
            self.assertEqual(user.plan, "premium")
            self.assertTrue(billing.is_premium(user))
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
