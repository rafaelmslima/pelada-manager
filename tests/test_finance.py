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
    pelada = models.Pelada(name="Pelada A", owner_user_id=user.id)
    db.add(pelada)
    db.commit()
    return pelada


class FinanceTest(unittest.TestCase):
    def test_balance_income_minus_expense(self):
        db = _new_session()
        try:
            pelada = _make_pelada(db)
            crud.create_finance_entry(
                db, pelada.id, schemas.FinanceEntryCreate(kind="income", amount=100, description="Diárias")
            )
            crud.create_finance_entry(
                db, pelada.id, schemas.FinanceEntryCreate(kind="expense", amount=30, description="Colete")
            )
            overview = crud.get_finance_overview(db, pelada)
            self.assertEqual(overview.total_income, 100)
            self.assertEqual(overview.total_expense, 30)
            self.assertEqual(overview.balance, 70)
            self.assertEqual(len(overview.entries), 2)
        finally:
            db.close()

    def test_collect_daily_from_confirmed_diaristas(self):
        db = _new_session()
        try:
            pelada = _make_pelada(db)
            crud.set_daily_fee(db, pelada, 10.0)
            crud.create_player(db, schemas.PlayerCreate(name="A", position="meio", rating=3, is_active=True), pelada.id)
            crud.create_player(db, schemas.PlayerCreate(name="B", position="ataque", rating=3, is_active=True), pelada.id)
            # mensalista confirmado nao paga diaria
            crud.create_player(
                db,
                schemas.PlayerCreate(name="C", position="defesa", rating=3, is_active=True, billing_type="mensalista"),
                pelada.id,
            )
            # diarista nao confirmado nao entra
            crud.create_player(db, schemas.PlayerCreate(name="D", position="meio", rating=3, is_active=False), pelada.id)

            entry = crud.collect_daily_from_confirmed(db, pelada)
            self.assertIsNotNone(entry)
            self.assertEqual(entry.amount, 20.0)  # 2 diaristas confirmados x 10
            self.assertEqual(crud.get_finance_overview(db, pelada).balance, 20.0)
        finally:
            db.close()

    def test_collect_daily_requires_fee(self):
        db = _new_session()
        try:
            pelada = _make_pelada(db)
            with self.assertRaises(ValueError):
                crud.collect_daily_from_confirmed(db, pelada)
        finally:
            db.close()

    def test_delete_entry_updates_balance(self):
        db = _new_session()
        try:
            pelada = _make_pelada(db)
            entry = crud.create_finance_entry(
                db, pelada.id, schemas.FinanceEntryCreate(kind="income", amount=50, description="x")
            )
            crud.delete_finance_entry(db, entry)
            self.assertEqual(crud.get_finance_overview(db, pelada).balance, 0)
        finally:
            db.close()

    def test_mensalistas_listed_with_payment_status(self):
        db = _new_session()
        try:
            pelada = _make_pelada(db)
            crud.create_player(
                db,
                schemas.PlayerCreate(
                    name="Mens", position="meio", rating=3, is_active=False, billing_type="mensalista", has_paid=True
                ),
                pelada.id,
            )
            crud.create_player(db, schemas.PlayerCreate(name="Dia", position="meio", rating=3, is_active=False), pelada.id)
            overview = crud.get_finance_overview(db, pelada)
            self.assertEqual(len(overview.mensalistas), 1)
            self.assertEqual(overview.mensalistas[0].name, "Mens")
            self.assertTrue(overview.mensalistas[0].has_paid)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
