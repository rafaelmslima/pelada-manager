"""add daily_fee and finance_entries (financeiro)

Revision ID: 20260722_06
Revises: 20260722_05
Create Date: 2026-07-22
"""

from alembic import op
import sqlalchemy as sa


revision = "20260722_06"
down_revision = "20260722_05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("peladas", sa.Column("daily_fee", sa.Float(), nullable=False, server_default="0"))
    op.alter_column("peladas", "daily_fee", server_default=None)

    op.create_table(
        "finance_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pelada_id", sa.Integer(), sa.ForeignKey("peladas.id"), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("description", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("player_id", sa.Integer(), sa.ForeignKey("players.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_finance_entries_pelada_id", "finance_entries", ["pelada_id"])
    op.create_index("ix_finance_entries_player_id", "finance_entries", ["player_id"])


def downgrade() -> None:
    op.drop_index("ix_finance_entries_player_id", table_name="finance_entries")
    op.drop_index("ix_finance_entries_pelada_id", table_name="finance_entries")
    op.drop_table("finance_entries")
    op.drop_column("peladas", "daily_fee")
