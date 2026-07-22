"""add player_ratings (avaliacao pos-jogo)

Revision ID: 20260722_05
Revises: 20260722_04
Create Date: 2026-07-22
"""

from alembic import op
import sqlalchemy as sa


revision = "20260722_05"
down_revision = "20260722_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "player_ratings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pelada_id", sa.Integer(), sa.ForeignKey("peladas.id"), nullable=False),
        sa.Column("match_id", sa.Integer(), sa.ForeignKey("matches.id"), nullable=False),
        sa.Column("player_id", sa.Integer(), sa.ForeignKey("players.id"), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("match_id", "player_id", name="uq_player_rating_match_player"),
    )
    op.create_index("ix_player_ratings_pelada_id", "player_ratings", ["pelada_id"])
    op.create_index("ix_player_ratings_match_id", "player_ratings", ["match_id"])
    op.create_index("ix_player_ratings_player_id", "player_ratings", ["player_id"])


def downgrade() -> None:
    op.drop_index("ix_player_ratings_player_id", table_name="player_ratings")
    op.drop_index("ix_player_ratings_match_id", table_name="player_ratings")
    op.drop_index("ix_player_ratings_pelada_id", table_name="player_ratings")
    op.drop_table("player_ratings")
