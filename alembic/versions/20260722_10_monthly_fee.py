"""add monthly fee, due day and player paid_month

Revision ID: 20260722_10
Revises: 20260722_09
Create Date: 2026-07-22
"""

from alembic import op
import sqlalchemy as sa


revision = "20260722_10"
down_revision = "20260722_09"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("peladas", sa.Column("monthly_fee", sa.Float(), nullable=False, server_default="0"))
    op.add_column("peladas", sa.Column("monthly_due_day", sa.Integer(), nullable=False, server_default="10"))
    op.add_column("players", sa.Column("paid_month", sa.String(length=7), nullable=True))
    op.alter_column("peladas", "monthly_fee", server_default=None)
    op.alter_column("peladas", "monthly_due_day", server_default=None)


def downgrade() -> None:
    op.drop_column("players", "paid_month")
    op.drop_column("peladas", "monthly_due_day")
    op.drop_column("peladas", "monthly_fee")
