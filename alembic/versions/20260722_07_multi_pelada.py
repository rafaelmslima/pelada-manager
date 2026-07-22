"""multi-pelada: pelada_members, active_pelada_id, invite_code

Revision ID: 20260722_07
Revises: 20260722_06
Create Date: 2026-07-22
"""

from alembic import op
import sqlalchemy as sa


revision = "20260722_07"
down_revision = "20260722_06"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("active_pelada_id", sa.Integer(), nullable=True))
    op.add_column("peladas", sa.Column("invite_code", sa.String(length=20), nullable=True))
    op.create_index("ix_peladas_invite_code", "peladas", ["invite_code"], unique=True)

    # Remove o unique do dono para permitir varias peladas por usuario.
    op.execute("ALTER TABLE peladas DROP CONSTRAINT IF EXISTS peladas_owner_user_id_key")

    op.create_table(
        "pelada_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("pelada_id", sa.Integer(), sa.ForeignKey("peladas.id"), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="member"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "pelada_id", name="uq_pelada_member"),
    )
    op.create_index("ix_pelada_members_user_id", "pelada_members", ["user_id"])
    op.create_index("ix_pelada_members_pelada_id", "pelada_members", ["pelada_id"])

    # Backfill: donos viram membros 'owner' e ganham pelada ativa.
    op.execute(
        "INSERT INTO pelada_members (user_id, pelada_id, role, created_at) "
        "SELECT owner_user_id, id, 'owner', CURRENT_TIMESTAMP FROM peladas p "
        "WHERE NOT EXISTS (SELECT 1 FROM pelada_members m WHERE m.pelada_id = p.id AND m.user_id = p.owner_user_id)"
    )
    op.execute(
        "UPDATE users SET active_pelada_id = "
        "(SELECT p.id FROM peladas p WHERE p.owner_user_id = users.id ORDER BY p.id LIMIT 1) "
        "WHERE active_pelada_id IS NULL"
    )


def downgrade() -> None:
    op.drop_index("ix_pelada_members_pelada_id", table_name="pelada_members")
    op.drop_index("ix_pelada_members_user_id", table_name="pelada_members")
    op.drop_table("pelada_members")
    op.drop_index("ix_peladas_invite_code", table_name="peladas")
    op.drop_column("peladas", "invite_code")
    op.drop_column("users", "active_pelada_id")
