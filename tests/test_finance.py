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
            crud.set_finance_settings(db, pelada, 10.0, 0, 10)
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

    def test_overdue_confirmed_mensalistas(self):
        db = _new_session()
        try:
            pelada = _make_pelada(db)
            crud.set_finance_settings(db, pelada, daily_fee=10, monthly_fee=50, monthly_due_day=1)
            # mensalista confirmado e nao pago -> atrasado (venc dia 1, hoje > 1 na maioria dos dias)
            m = crud.create_player(
                db,
                schemas.PlayerCreate(name="M", position="meio", rating=3, is_active=True, billing_type="mensalista"),
                pelada.id,
            )
            # diarista confirmado nao entra
            crud.create_player(db, schemas.PlayerCreate(name="D", position="meio", rating=3, is_active=True), pelada.id)

            import datetime as _dt

            overdue = crud.overdue_confirmed_mensalistas(db, pelada)
            if _dt.date.today().day > 1:
                self.assertEqual([p.id for p in overdue], [m.id])
            # pagando, sai da lista
            crud.toggle_player_monthly_paid(db, m)
            self.assertEqual(crud.overdue_confirmed_mensalistas(db, pelada), [])
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

    def test_mensalistas_monthly_status_and_toggle(self):
        db = _new_session()
        try:
            pelada = _make_pelada(db)
            mens = crud.create_player(
                db,
                schemas.PlayerCreate(name="Mens", position="meio", rating=3, is_active=False, billing_type="mensalista"),
                pelada.id,
            )
            crud.create_player(db, schemas.PlayerCreate(name="Dia", position="meio", rating=3, is_active=False), pelada.id)

            overview = crud.get_finance_overview(db, pelada)
            self.assertEqual(len(overview.mensalistas), 1)
            self.assertEqual(overview.mensalistas[0].name, "Mens")
            self.assertFalse(overview.mensalistas[0].up_to_date)  # comeca pendente

            # Paga a mensalidade do mes -> em dia
            crud.toggle_player_monthly_paid(db, mens)
            self.assertEqual(mens.paid_month, crud.current_month())
            overview = crud.get_finance_overview(db, pelada)
            self.assertTrue(overview.mensalistas[0].up_to_date)
            self.assertFalse(overview.mensalistas[0].overdue)

            # Virada de mes simulada: paid_month antigo -> volta a pendente automaticamente
            mens.paid_month = "2020-01"
            db.commit()
            overview = crud.get_finance_overview(db, pelada)
            self.assertFalse(overview.mensalistas[0].up_to_date)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
