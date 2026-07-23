"""add user plan (freemium)

Revision ID: 20260722_08
Revises: 20260722_07
Create Date: 2026-07-22
"""

from alembic import op
import sqlalchemy as sa


revision = "20260722_08"
down_revision = "20260722_07"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("plan", sa.String(length=20), nullable=False, server_default="free"))
    op.alter_column("users", "plan", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "plan")
