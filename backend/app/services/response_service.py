import secrets

from pydantic import JsonValue
from sqlalchemy import Select, delete, exists, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.clock import utcnow
from app.core.errors import ConflictError, NotFoundError, ValidationFailedError
from app.models.answer import Answer, AnswerOption
from app.models.form import Form
from app.models.question import Question
from app.models.response import Response
from app.question_types import get_handler
from app.schemas.form import FormSettings
from app.schemas.question import QuestionOut
from app.schemas.response import (
    AnswerIn,
    ResponseAnswerOut,
    ResponseDetailOut,
    ResponseListOut,
    ResponseRowOut,
    SubmitIn,
)

# ---------- Public: fetch, start, submit ----------


def get_published_form(db: Session, slug: str) -> Form:
    query = (
        select(Form)
        .where(Form.slug == slug, Form.status == "published")
        .options(selectinload(Form.questions).selectinload(Question.options))
    )
    form = db.scalar(query)
    if form is None:
        raise NotFoundError("This form is not available")
    return form


def start_response(db: Session, slug: str, metadata: dict[str, JsonValue], user_agent: str | None) -> Response:
    form = get_published_form(db, slug)
    response = Response(
        form_id=form.id,
        token=secrets.token_urlsafe(16),
        client_metadata={**metadata, "user_agent": user_agent},
    )
    db.add(response)
    db.commit()
    return response


def _get_open_response(db: Session, form: Form, token: str) -> Response:
    response = db.scalar(select(Response).where(Response.token == token, Response.form_id == form.id))
    if response is None:
        raise NotFoundError("Response not found")
    if response.status == "completed":
        raise ConflictError("This response has already been submitted")
    return response


def _validate_answers(questions: list[Question], answers: list[AnswerIn]) -> dict[str, str]:
    """Return {question_id: message} for every invalid answer; empty means all good."""
    errors: dict[str, str] = {}
    given: dict[int, JsonValue] = {}
    live_ids = {question.id for question in questions}

    for answer in answers:
        if answer.question_id not in live_ids:
            errors[str(answer.question_id)] = "This question does not exist"
        elif answer.question_id in given:
            errors[str(answer.question_id)] = "This question was answered more than once"
        else:
            given[answer.question_id] = answer.value

    for question in questions:
        if str(question.id) in errors:
            continue
        handler = get_handler(question.type)
        value = given.get(question.id)
        if handler.is_empty(value):
            if question.required:
                errors[str(question.id)] = "This question is required"
            continue
        message = handler.validate(question, value)
        if message:
            errors[str(question.id)] = message
    return errors


def submit_response(db: Session, slug: str, token: str, payload: SubmitIn) -> FormSettings:
    form = get_published_form(db, slug)
    response = _get_open_response(db, form, token)
    questions = form.live_questions

    errors = _validate_answers(questions, payload.answers)
    if errors:
        raise ValidationFailedError(errors=errors)

    # Everything below is one transaction: either all answers and the status change
    # are saved, or (on any error) none of them are.
    values = {answer.question_id: answer.value for answer in payload.answers}
    for question in questions:
        handler = get_handler(question.type)
        value = values.get(question.id)
        if handler.is_empty(value):
            continue
        columns = handler.to_columns(value)
        response.answers.append(
            Answer(
                question_id=question.id,
                text_value=columns.text_value,
                number_value=columns.number_value,
                boolean_value=columns.boolean_value,
                answer_options=[AnswerOption(option_id=option_id) for option_id in columns.option_ids],
            )
        )
    response.status = "completed"
    response.submitted_at = utcnow()
    db.commit()
    return FormSettings.model_validate(form.settings)


# ---------- Creator: results ----------


def questions_for_results(db: Session, form: Form) -> list[Question]:
    """Live questions plus soft-deleted ones that still have answers, so old data stays visible."""
    has_answers = exists().where(Answer.question_id == Question.id)
    query = (
        select(Question)
        .where(Question.form_id == form.id, (Question.deleted_at.is_(None)) | has_answers)
        .options(selectinload(Question.options))
        .order_by(Question.deleted_at.is_not(None), Question.position, Question.id)
    )
    return list(db.scalars(query))


def _answer_map(response: Response) -> dict[int, Answer]:
    return {answer.question_id: answer for answer in response.answers}


def completed_responses_query(form_id: int) -> Select[tuple[Response]]:
    return (
        select(Response)
        .where(Response.form_id == form_id, Response.status == "completed")
        .options(
            selectinload(Response.answers)
            .selectinload(Answer.answer_options)
            .selectinload(AnswerOption.option)
        )
    )


def list_responses(db: Session, form: Form, page: int, limit: int) -> ResponseListOut:
    questions = questions_for_results(db, form)
    types = {question.id: question.type for question in questions}

    total = db.scalar(
        select(func.count()).select_from(Response).where(Response.form_id == form.id, Response.status == "completed")
    ) or 0
    query = (
        completed_responses_query(form.id)
        .order_by(Response.submitted_at.desc(), Response.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    items = [
        ResponseRowOut(
            id=response.id,
            submitted_at=response.submitted_at,  # type: ignore[arg-type]
            answers={
                str(answer.question_id): get_handler(types[answer.question_id]).display_value(answer)
                for answer in response.answers
                if answer.question_id in types
            },
        )
        for response in db.scalars(query)
    ]
    return ResponseListOut(
        items=items,
        total=total,
        page=page,
        limit=limit,
        questions=[QuestionOut.model_validate(question) for question in questions],
    )


def get_completed_response(db: Session, form: Form, response_id: int) -> Response:
    response = db.scalar(completed_responses_query(form.id).where(Response.id == response_id))
    if response is None:
        raise NotFoundError("Response not found")
    return response


def get_response_detail(db: Session, form: Form, response_id: int) -> ResponseDetailOut:
    response = get_completed_response(db, form, response_id)
    answers = _answer_map(response)
    rows: list[ResponseAnswerOut] = []
    for question in questions_for_results(db, form):
        answer = answers.get(question.id)
        value = get_handler(question.type).display_value(answer) if answer else None
        rows.append(ResponseAnswerOut(question=QuestionOut.model_validate(question), value=value))
    return ResponseDetailOut(
        id=response.id,
        started_at=response.started_at,
        submitted_at=response.submitted_at,  # type: ignore[arg-type]
        answers=rows,
    )


def delete_response(db: Session, form: Form, response_id: int) -> None:
    get_completed_response(db, form, response_id)
    db.execute(delete(Response).where(Response.id == response_id))  # DB cascades to answers
    db.commit()
