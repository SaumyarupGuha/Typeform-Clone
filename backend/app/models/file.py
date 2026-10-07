from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.clock import utcnow
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.answer import Answer


class UploadedFile(Base):
    """A file a respondent uploaded for a file_upload question.

    The file is uploaded first (while answering) and linked to its answer when the answer is
    saved, which is why `answer_id` starts empty. The bytes live on disk under `storage_key`.
    """

    __tablename__ = "files"
    __table_args__ = (
        UniqueConstraint("response_id", "question_id"),  # one file per question per response
        Index("ix_files_response", "response_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    response_id: Mapped[int] = mapped_column(ForeignKey("responses.id", ondelete="CASCADE"))
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"))
    answer_id: Mapped[int | None] = mapped_column(ForeignKey("answers.id", ondelete="SET NULL"))
    original_name: Mapped[str] = mapped_column(Text)
    content_type: Mapped[str] = mapped_column(Text)
    size_bytes: Mapped[int] = mapped_column(Integer)
    storage_key: Mapped[str] = mapped_column(Text, unique=True)  # random file name inside the upload folder
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    answer: Mapped[Answer | None] = relationship(back_populates="file")
