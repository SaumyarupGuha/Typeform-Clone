from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, CheckConstraint, ForeignKey, Index, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.clock import utcnow
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.question import Question
    from app.models.response import Response


class Form(Base):
    __tablename__ = "forms"
    __table_args__ = (
        CheckConstraint("status IN ('draft','published')", name="ck_forms_status"),
        Index("ix_forms_owner", "owner_id", "updated_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(Text, default="My new form", server_default="My new form")
    slug: Mapped[str] = mapped_column(Text, unique=True)
    status: Mapped[str] = mapped_column(Text, default="draft", server_default="draft")
    settings: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, server_default=text("'{}'"))
    published_at: Mapped[datetime | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)

    questions: Mapped[list[Question]] = relationship(
        back_populates="form", cascade="all, delete-orphan", passive_deletes=True
    )
    responses: Mapped[list[Response]] = relationship(
        back_populates="form", cascade="all, delete-orphan", passive_deletes=True
    )

    @property
    def live_questions(self) -> list[Question]:
        """Questions that have not been soft-deleted, in display order."""
        live = [q for q in self.questions if q.deleted_at is None]
        return sorted(live, key=lambda q: q.position)
