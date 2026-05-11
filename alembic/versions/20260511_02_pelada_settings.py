"""add pelada settings

Revision ID: 20260511_02
Revises: 20260510_01
Create Date: 2026-05-11
"""

from alembic import op
import sqlalchemy as sa


revision = "20260511_02"
down_revision = "20260510_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("peladas", sa.Column("location", sa.String(length=160), nullable=False, server_default=""))
    op.add_column("peladas", sa.Column("match_time", sa.String(length=20), nullable=False, server_default="20:00"))
    op.add_column(
        "peladas",
        sa.Column("default_billing_type", sa.String(length=20), nullable=False, server_default="diarista"),
    )
    op.alter_column("peladas", "location", server_default=None)
    op.alter_column("peladas", "match_time", server_default=None)
    op.alter_column("peladas", "default_billing_type", server_default=None)


def downgrade() -> None:
    op.drop_column("peladas", "default_billing_type")
    op.drop_column("peladas", "match_time")
    op.drop_column("peladas", "location")
