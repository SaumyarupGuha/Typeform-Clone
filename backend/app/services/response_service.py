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
    ProgressIn,
    ResponseAnswerOut,
    ResponseDetailOut,
    ResponseListOut,
    ResponseRowOut,
    ResponseStatusFilter,
    SubmitIn,
)
from app.services import logic_service

# A response row is "in_progress" in the database and shown as "partial" in the API and UI.
PUBLIC_STATUS = {"completed": "completed", "in_progress": "partial"}

# ---------- Public: fetch, start, save progress, submit ----------


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


def _validate_answers(questions: list[Question], answers: list[AnswerIn]) -> tuple[dict[str, str], list[Question]]:
    """Check the answers. Returns ({question_id: message}, the questions on the respondent's path).

    Only questions the respondent actually saw count: logic jumps can skip a required
    question, and an answer to a skipped question is ignored rather than stored.
    """
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

    path = logic_service.compute_path(questions, given)
    for question in path:
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
    return errors, path


def _replace_answers(db: Session, response: Response, values: dict[int, JsonValue]) -> None:
    """Make the stored answers of `response` exactly `values` (question id -> validated value).

    Replacing, rather than adding, is what lets the same response be saved over and over
    as a respondent goes (progress) and finally submitted.
    """
    db.execute(delete(Answer).where(Answer.response_id == response.id))  # answer_options cascade
    types = _question_types(db, response)
    for question_id, value in values.items():
        columns = get_handler(types[question_id]).to_columns(value)
        db.add(
            Answer(
                response_id=response.id,
                question_id=question_id,
                text_value=columns.text_value,
                number_value=columns.number_value,
                boolean_value=columns.boolean_value,
                answer_options=[AnswerOption(option_id=option_id) for option_id in columns.option_ids],
            )
        )


def _question_types(db: Session, response: Response) -> dict[int, str]:
    rows = db.execute(select(Question.id, Question.type).where(Question.form_id == response.form_id))
    return {question_id: question_type for question_id, question_type in rows}


def save_progress(db: Session, slug: str, token: str, payload: ProgressIn) -> None:
    """Store the answers given so far, so a respondent who leaves is still counted and readable.

    Unlike a submit this never complains: required questions may still be open, and an answer that
    does not validate yet (half-typed) is simply not saved. The next call overwrites this one.
    """
    form = get_published_form(db, slug)
    response = _get_open_response(db, form, token)
    questions = form.live_questions
    live_ids = {question.id for question in questions}

    given = {a.question_id: a.value for a in payload.answers if a.question_id in live_ids}
    storable: dict[int, JsonValue] = {}
    for question in logic_service.compute_path(questions, given):
        handler = get_handler(question.type)
        value = given.get(question.id)
        if not handler.is_empty(value) and handler.validate(question, value) is None:
            storable[question.id] = value
    _replace_answers(db, response, storable)
    db.commit()


def submit_response(db: Session, slug: str, token: str, payload: SubmitIn) -> FormSettings:
    form = get_published_form(db, slug)
    response = _get_open_response(db, form, token)
    questions = form.live_questions

    errors, path = _validate_answers(questions, payload.answers)
    if errors:
        raise ValidationFailedError(errors=errors)

    # Everything below is one transaction: either all answers and the status change
    # are saved, or (on any error) none of them are.
    given = {answer.question_id: answer.value for answer in payload.answers}
    final = {
        question.id: given[question.id]
        for question in path
        if question.id in given and not get_handler(question.type).is_empty(given[question.id])
    }
    _replace_answers(db, response, final)
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


def responses_query(form_id: int, status: ResponseStatusFilter = "completed") -> Select[tuple[Response]]:
    """Responses of a form with their answers loaded. `status` picks completed, partial or both."""
    query = (
        select(Response)
        .where(Response.form_id == form_id)
        .options(
            selectinload(Response.answers)
            .selectinload(Answer.answer_options)
            .selectinload(AnswerOption.option)
        )
    )
    if status == "completed":
        query = query.where(Response.status == "completed")
    elif status == "partial":
        query = query.where(Response.status == "in_progress")
    return query


def newest_first(query: Select[tuple[Response]]) -> Select[tuple[Response]]:
    # Completed responses sort by when they were submitted, partial ones by when they started.
    return query.order_by(func.coalesce(Response.submitted_at, Response.started_at).desc(), Response.id.desc())


def _last_answered(response: Response, order: dict[int, int]) -> int | None:
    """The furthest question (by form order) this response has an answer to."""
    answered = [a.question_id for a in response.answers if a.question_id in order]
    return max(answered, key=lambda question_id: order[question_id]) if answered else None


def count_by_status(db: Session, form_id: int) -> tuple[int, int]:
    """(completed, partial) response counts."""
    rows = dict(
        db.execute(select(Response.status, func.count()).where(Response.form_id == form_id).group_by(Response.status)).all()
    )
    return rows.get("completed", 0), rows.get("in_progress", 0)


def list_responses(db: Session, form: Form, page: int, limit: int, status: ResponseStatusFilter) -> ResponseListOut:
    questions = questions_for_results(db, form)
    types = {question.id: question.type for question in questions}
    order = {question.id: index for index, question in enumerate(questions)}
    completed_count, partial_count = count_by_status(db, form.id)
    total = {"completed": completed_count, "partial": partial_count, "all": completed_count + partial_count}[status]

    query = newest_first(responses_query(form.id, status)).offset((page - 1) * limit).limit(limit)
    items = [
        ResponseRowOut(
            id=response.id,
            status=PUBLIC_STATUS[response.status],  # type: ignore[arg-type]
            started_at=response.started_at,
            submitted_at=response.submitted_at,
            last_question_id=_last_answered(response, order),
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
        completed_count=completed_count,
        partial_count=partial_count,
        questions=[QuestionOut.model_validate(question) for question in questions],
    )


def get_response(db: Session, form: Form, response_id: int) -> Response:
    response = db.scalar(responses_query(form.id, "all").where(Response.id == response_id))
    if response is None:
        raise NotFoundError("Response not found")
    return response


def get_response_detail(db: Session, form: Form, response_id: int) -> ResponseDetailOut:
    response = get_response(db, form, response_id)
    answers = _answer_map(response)
    questions = questions_for_results(db, form)
    order = {question.id: index for index, question in enumerate(questions)}
    rows: list[ResponseAnswerOut] = []
    for question in questions:
        answer = answers.get(question.id)
        value = get_handler(question.type).display_value(answer) if answer else None
        rows.append(ResponseAnswerOut(question=QuestionOut.model_validate(question), value=value))
    return ResponseDetailOut(
        id=response.id,
        status=PUBLIC_STATUS[response.status],  # type: ignore[arg-type]
        started_at=response.started_at,
        submitted_at=response.submitted_at,
        last_question_id=_last_answered(response, order),
        answers=rows,
    )


def delete_response(db: Session, form: Form, response_id: int) -> None:
    get_response(db, form, response_id)
    db.execute(delete(Response).where(Response.id == response_id))  # DB cascades to answers
    db.commit()
