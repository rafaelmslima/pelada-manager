"""initial schema with auth and pelada multi-tenant

Revision ID: 20260510_01
Revises:
Create Date: 2026-05-10
"""

from alembic import op
import sqlalchemy as sa


revision = "20260510_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "peladas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("owner_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_peladas_id", "peladas", ["id"])
    op.create_index("ix_peladas_owner_user_id", "peladas", ["owner_user_id"], unique=True)

    op.create_table(
        "user_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_user_sessions_id", "user_sessions", ["id"])
    op.create_index("ix_user_sessions_token", "user_sessions", ["token"], unique=True)
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])

    op.create_table(
        "players",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pelada_id", sa.Integer(), sa.ForeignKey("peladas.id"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("position", sa.String(length=20), nullable=False),
        sa.Column("rating", sa.Float(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("billing_type", sa.String(length=20), nullable=False),
        sa.Column("has_paid", sa.Boolean(), nullable=False),
        sa.Column("whatsapp", sa.String(length=30), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_players_id", "players", ["id"])
    op.create_index("ix_players_name", "players", ["name"])
    op.create_index("ix_players_position", "players", ["position"])
    op.create_index("ix_players_pelada_id", "players", ["pelada_id"])

    op.create_table(
        "matches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pelada_id", sa.Integer(), sa.ForeignKey("peladas.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_matches_id", "matches", ["id"])
    op.create_index("ix_matches_date", "matches", ["date"])
    op.create_index("ix_matches_pelada_id", "matches", ["pelada_id"])

    op.create_table(
        "match_teams",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pelada_id", sa.Integer(), sa.ForeignKey("peladas.id"), nullable=False),
        sa.Column("match_id", sa.Integer(), sa.ForeignKey("matches.id"), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("total_rating", sa.Float(), nullable=False),
        sa.Column("is_team_of_the_week", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_match_teams_id", "match_teams", ["id"])
    op.create_index("ix_match_teams_match_id", "match_teams", ["match_id"])
    op.create_index("ix_match_teams_pelada_id", "match_teams", ["pelada_id"])

    op.create_table(
        "match_players",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pelada_id", sa.Integer(), sa.ForeignKey("peladas.id"), nullable=False),
        sa.Column("match_id", sa.Integer(), sa.ForeignKey("matches.id"), nullable=False),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("match_teams.id"), nullable=False),
        sa.Column("player_id", sa.Integer(), sa.ForeignKey("players.id"), nullable=False),
        sa.Column("goals", sa.Integer(), nullable=False),
        sa.Column("assists", sa.Integer(), nullable=False),
        sa.Column("was_in_team_of_the_week", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_match_players_id", "match_players", ["id"])
    op.create_index("ix_match_players_match_id", "match_players", ["match_id"])
    op.create_index("ix_match_players_team_id", "match_players", ["team_id"])
    op.create_index("ix_match_players_player_id", "match_players", ["player_id"])
    op.create_index("ix_match_players_pelada_id", "match_players", ["pelada_id"])


def downgrade() -> None:
    op.drop_table("match_players")
    op.drop_table("match_teams")
    op.drop_table("matches")
    op.drop_table("players")
    op.drop_table("user_sessions")
    op.drop_table("peladas")
    op.drop_table("users")
