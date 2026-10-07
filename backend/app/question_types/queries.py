"""SQL building blocks shared by the stats functions. Only completed responses count."""

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models.answer import Answer
from app.models.response import Response


def completed_answers(question_id: int) -> Select[tuple[Answer]]:
    return (
        select(Answer)
        .join(Response, Response.id == Answer.response_id)
        .where(Answer.question_id == question_id, Response.status == "completed")
    )


def count_answers(db: Session, question_id: int) -> int:
    subquery = completed_answers(question_id).subquery()
    return db.scalar(select(func.count()).select_from(subquery)) or 0


def percent(count: int, total: int) -> float:
    return round(count * 100 / total, 1) if total else 0.0
