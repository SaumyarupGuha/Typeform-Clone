from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, CheckConstraint, ForeignKey, Index, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.clock import utcnow
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.answer import Answer
    from app.models.form import Form


class Response(Base):
    __tablename__ = "responses"
    __table_args__ = (
        CheckConstraint("status IN ('in_progress','completed')", name="ck_responses_status"),
        Index("ix_responses_form", "form_id", "status", "submitted_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    form_id: Mapped[int] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"))
    token: Mapped[str] = mapped_column(Text, unique=True)
    status: Mapped[str] = mapped_column(Text, default="in_progress", server_default="in_progress")
    started_at: Mapped[datetime] = mapped_column(default=utcnow)
    submitted_at: Mapped[datetime | None] = mapped_column(default=None)
    # "metadata" is reserved on declarative classes, so the attribute is named differently.
    client_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, server_default=text("'{}'")
    )

    form: Mapped[Form] = relationship(back_populates="responses")
    answers: Mapped[list[Answer]] = relationship(
        back_populates="response", cascade="all, delete-orphan", passive_deletes=True
    )
