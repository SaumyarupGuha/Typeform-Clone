from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Boolean, CheckConstraint, ForeignKey, Index, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.clock import utcnow
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.form import Form

# Kept here (not in question_types/) so the models never import the registry,
# which itself imports the models. tests/test_question_types.py keeps both in sync.
QUESTION_TYPE_NAMES = (
    "short_text",
    "long_text",
    "multiple_choice",
    "dropdown",
    "email",
    "number",
    "yes_no",
    "rating",
    "file_upload",
)
_TYPE_LIST_SQL = ",".join(f"'{name}'" for name in QUESTION_TYPE_NAMES)


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (
        CheckConstraint(f"type IN ({_TYPE_LIST_SQL})", name="ck_questions_type"),
        Index("ix_questions_form_pos", "form_id", "position"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    form_id: Mapped[int] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"))
    position: Mapped[int]
    type: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text, default="", server_default="")
    description: Mapped[str | None] = mapped_column(Text, default=None)
    required: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("0"))
    properties: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, server_default=text("'{}'"))
    deleted_at: Mapped[datetime | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)

    form: Mapped[Form] = relationship(back_populates="questions")
    options: Mapped[list[QuestionOption]] = relationship(
        back_populates="question",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="QuestionOption.position",
    )


    @property
    def deleted(self) -> bool:
        return self.deleted_at is not None

    @property
    def logic(self) -> dict[str, Any]:
        """Logic-jump rules; stored inside `properties` so the table needs no extra column."""
        raw = self.properties.get("logic")
        return raw if isinstance(raw, dict) else {}


class QuestionOption(Base):
    __tablename__ = "question_options"
    __table_args__ = (Index("ix_options_question", "question_id", "position"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"))
    position: Mapped[int]
    label: Mapped[str] = mapped_column(Text)

    question: Mapped[Question] = relationship(back_populates="options")
