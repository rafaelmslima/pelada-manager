"""add match_rounds and round_player_stats (confrontos ao vivo)

Revision ID: 20260722_09
Revises: 20260722_08
Create Date: 2026-07-22
"""

from alembic import op
import sqlalchemy as sa


revision = "20260722_09"
down_revision = "20260722_08"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "match_rounds",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pelada_id", sa.Integer(), sa.ForeignKey("peladas.id"), nullable=False),
        sa.Column("match_id", sa.Integer(), sa.ForeignKey("matches.id"), nullable=False),
        sa.Column("team_a_id", sa.Integer(), sa.ForeignKey("match_teams.id"), nullable=False),
        sa.Column("team_b_id", sa.Integer(), sa.ForeignKey("match_teams.id"), nullable=False),
        sa.Column("goals_a", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("goals_b", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_match_rounds_match_id", "match_rounds", ["match_id"])
    op.create_index("ix_match_rounds_pelada_id", "match_rounds", ["pelada_id"])

    op.create_table(
        "round_player_stats",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pelada_id", sa.Integer(), sa.ForeignKey("peladas.id"), nullable=False),
        sa.Column("round_id", sa.Integer(), sa.ForeignKey("match_rounds.id"), nullable=False),
        sa.Column("player_id", sa.Integer(), sa.ForeignKey("players.id"), nullable=False),
        sa.Column("goals", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("assists", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_round_player_stats_round_id", "round_player_stats", ["round_id"])


def downgrade() -> None:
    op.drop_index("ix_round_player_stats_round_id", table_name="round_player_stats")
    op.drop_table("round_player_stats")
    op.drop_index("ix_match_rounds_pelada_id", table_name="match_rounds")
    op.drop_index("ix_match_rounds_match_id", table_name="match_rounds")
    op.drop_table("match_rounds")
