"""add users.name (nome de exibicao do usuario)

Revision ID: 20260723_13
Revises: 20260722_12
Create Date: 2026-07-23
"""

from alembic import op
import sqlalchemy as sa


revision = "20260723_13"
down_revision = "20260722_12"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("name", sa.String(length=120), nullable=False, server_default=""))
    op.alter_column("users", "name", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "name")
