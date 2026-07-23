"""add player paid_date (diaria do dia) and finance_entries ref_period

Revision ID: 20260722_11
Revises: 20260722_10
Create Date: 2026-07-22
"""

from alembic import op
import sqlalchemy as sa


revision = "20260722_11"
down_revision = "20260722_10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("players", sa.Column("paid_date", sa.String(length=10), nullable=True))
    op.add_column("finance_entries", sa.Column("ref_period", sa.String(length=10), nullable=True))


def downgrade() -> None:
    op.drop_column("finance_entries", "ref_period")
    op.drop_column("players", "paid_date")
