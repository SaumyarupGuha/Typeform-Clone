from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.form import Form
from app.models.response import Response
from app.question_types import get_handler
from app.question_types.queries import count_answers
from app.schemas.summary import QuestionSummaryOut, SummaryOut


def build_summary(db: Session, form: Form) -> SummaryOut:
    started = db.scalar(select(func.count()).select_from(Response).where(Response.form_id == form.id)) or 0
    completed_rows = db.execute(
        select(Response.started_at, Response.submitted_at).where(
            Response.form_id == form.id, Response.status == "completed"
        )
    ).all()

    durations = [(end - start).total_seconds() for start, end in completed_rows if end is not None]
    completed = len(completed_rows)

    questions = [
        QuestionSummaryOut(
            question_id=question.id,
            title=question.title,
            type=question.type,
            answered=count_answers(db, question.id),
            stats=get_handler(question.type).stats(db, question),
        )
        for question in form.live_questions
    ]
    return SummaryOut(
        started=started,
        completed=completed,
        completion_rate=round(completed * 100 / started, 1) if started else 0.0,
        avg_seconds=round(sum(durations) / len(durations), 1) if durations else None,
        questions=questions,
    )
