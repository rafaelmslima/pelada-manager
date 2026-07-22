"""add presence status and pelada public confirmation token

Revision ID: 20260721_03
Revises: 20260511_02
Create Date: 2026-07-21
"""

from alembic import op
import sqlalchemy as sa


revision = "20260721_03"
down_revision = "20260511_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Token do link publico de confirmacao (por pelada).
    op.add_column("peladas", sa.Column("public_token", sa.String(length=64), nullable=True))
    op.create_index("ix_peladas_public_token", "peladas", ["public_token"], unique=True)

    # Status de presenca por jogador.
    op.add_column(
        "players",
        sa.Column("presence", sa.String(length=20), nullable=False, server_default="pending"),
    )
    # Backfill: quem ja estava ativo vira "confirmed".
    op.execute("UPDATE players SET presence = 'confirmed' WHERE is_active")
    op.alter_column("players", "presence", server_default=None)


def downgrade() -> None:
    op.drop_column("players", "presence")
    op.drop_index("ix_peladas_public_token", table_name="peladas")
    op.drop_column("peladas", "public_token")
