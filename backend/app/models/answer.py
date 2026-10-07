from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import REAL, Boolean, ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.question import QuestionOption
from app.models.response import Response

if TYPE_CHECKING:
    from app.models.file import UploadedFile


class Answer(Base):
    __tablename__ = "answers"
    __table_args__ = (
        UniqueConstraint("response_id", "question_id"),
        Index("ix_answers_question", "question_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    response_id: Mapped[int] = mapped_column(ForeignKey("responses.id", ondelete="CASCADE"))
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"))
    text_value: Mapped[str | None] = mapped_column(Text)  # short_text, long_text, email
    number_value: Mapped[float | None] = mapped_column(REAL)  # number, rating
    boolean_value: Mapped[bool | None] = mapped_column(Boolean)  # yes_no

    response: Mapped[Response] = relationship(back_populates="answers")
    answer_options: Mapped[list[AnswerOption]] = relationship(
        back_populates="answer", cascade="all, delete-orphan", passive_deletes=True
    )
    # Only file_upload answers have one.
    file: Mapped[UploadedFile | None] = relationship(back_populates="answer", uselist=False)


class AnswerOption(Base):
    """Join table: multiple_choice (1..n rows per answer) and dropdown (1 row)."""

    __tablename__ = "answer_options"
    __table_args__ = (Index("ix_answer_options_option", "option_id"),)

    answer_id: Mapped[int] = mapped_column(ForeignKey("answers.id", ondelete="CASCADE"), primary_key=True)
    option_id: Mapped[int] = mapped_column(ForeignKey("question_options.id"), primary_key=True)

    answer: Mapped[Answer] = relationship(back_populates="answer_options")
    option: Mapped[QuestionOption] = relationship()
