"""add matches.live_state and match_players.wins

Revision ID: 20260722_12
Revises: 20260722_11
Create Date: 2026-07-22
"""

from alembic import op
import sqlalchemy as sa


revision = "20260722_12"
down_revision = "20260722_11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("matches", sa.Column("live_state", sa.Text(), nullable=True))
    op.add_column("match_players", sa.Column("wins", sa.Integer(), nullable=False, server_default="0"))
    op.alter_column("match_players", "wins", server_default=None)


def downgrade() -> None:
    op.drop_column("match_players", "wins")
    op.drop_column("matches", "live_state")
