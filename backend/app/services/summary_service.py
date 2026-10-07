from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.form import Form
from app.models.response import Response
from app.question_types import get_handler
from app.question_types.queries import count_answers
from app.models.answer import Answer
from app.schemas.summary import FunnelStepOut, QuestionSummaryOut, SummaryOut


def build_summary(db: Session, form: Form) -> SummaryOut:
    started = db.scalar(select(func.count()).select_from(Response).where(Response.form_id == form.id)) or 0
    completed_rows = db.execute(
        select(Response.started_at, Response.submitted_at).where(
            Response.form_id == form.id, Response.status == "completed"
        )
    ).all()

    durations = [(end - start).total_seconds() for start, end in completed_rows if end is not None]
    completed = len(completed_rows)
    funnel, left_before_first = _build_funnel(db, form)

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
        partial=started - completed,
        completion_rate=round(completed * 100 / started, 1) if started else 0.0,
        avg_seconds=round(sum(durations) / len(durations), 1) if durations else None,
        left_before_first=left_before_first,
        funnel=funnel,
        questions=questions,
    )


def _build_funnel(db: Session, form: Form) -> tuple[list[FunnelStepOut], int]:
    """Where respondents drop off.

    `answered` counts every response that answered a question (completed or not), so the bars
    shrink toward the end of the form. `left_here` counts partial responses whose furthest
    answer is that question, i.e. the people who stopped right after it.
    """
    questions = form.live_questions
    position = {question.id: index for index, question in enumerate(questions)}

    answered_rows = db.execute(
        select(Answer.question_id, func.count())
        .join(Response, Response.id == Answer.response_id)
        .where(Response.form_id == form.id)
        .group_by(Answer.question_id)
    ).all()
    answered = {question_id: count for question_id, count in answered_rows}

    partial_ids = list(
        db.scalars(select(Response.id).where(Response.form_id == form.id, Response.status == "in_progress"))
    )
    answers_by_response: dict[int, list[int]] = {response_id: [] for response_id in partial_ids}
    if partial_ids:
        for response_id, question_id in db.execute(
            select(Answer.response_id, Answer.question_id).where(Answer.response_id.in_(partial_ids))
        ):
            if question_id in position:
                answers_by_response[response_id].append(question_id)

    left_here: dict[int, int] = {}
    left_before_first = 0
    for question_ids in answers_by_response.values():
        if not question_ids:
            left_before_first += 1
            continue
        furthest = max(question_ids, key=lambda question_id: position[question_id])
        left_here[furthest] = left_here.get(furthest, 0) + 1

    funnel = [
        FunnelStepOut(
            question_id=question.id,
            title=question.title,
            answered=answered.get(question.id, 0),
            left_here=left_here.get(question.id, 0),
        )
        for question in questions
    ]
    return funnel, left_before_first
