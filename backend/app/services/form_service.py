import secrets
import string

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.clock import utcnow
from app.core.errors import NotFoundError, ValidationFailedError
from app.models.form import Form
from app.models.question import Question, QuestionOption
from app.models.response import Response
from app.models.user import User
from app.question_types import get_handler
from app.schemas.form import FormSettings, FormSummaryOut, FormUpdate
from app.services import logic_service

SLUG_ALPHABET = string.ascii_letters + string.digits
SLUG_LENGTH = 8


def generate_slug(db: Session) -> str:
    while True:
        slug = "".join(secrets.choice(SLUG_ALPHABET) for _ in range(SLUG_LENGTH))
        if db.scalar(select(Form.id).where(Form.slug == slug)) is None:
            return slug


def list_forms(db: Session, user: User, search: str | None, status: str | None) -> list[FormSummaryOut]:
    # One grouped subquery for all counts instead of a COUNT per form (no N+1).
    completed_counts = (
        select(Response.form_id, func.count().label("total"))
        .where(Response.status == "completed")
        .group_by(Response.form_id)
        .subquery()
    )
    query = (
        select(Form, func.coalesce(completed_counts.c.total, 0))
        .outerjoin(completed_counts, completed_counts.c.form_id == Form.id)
        .where(Form.owner_id == user.id)
        .order_by(Form.updated_at.desc(), Form.id.desc())
    )
    if search:
        query = query.where(Form.title.ilike(f"%{search}%"))
    if status:
        query = query.where(Form.status == status)
    return [FormSummaryOut.from_model(form, count) for form, count in db.execute(query)]


def get_owned_form(db: Session, user: User, form_id: int) -> Form:
    query = (
        select(Form)
        .where(Form.id == form_id, Form.owner_id == user.id)
        .options(selectinload(Form.questions).selectinload(Question.options))
    )
    form = db.scalar(query)
    if form is None:
        raise NotFoundError("Form not found")
    return form


def create_form(db: Session, user: User, title: str) -> Form:
    form = Form(
        owner_id=user.id,
        title=title.strip(),
        slug=generate_slug(db),
        settings=FormSettings().model_dump(),
    )
    db.add(form)
    db.commit()
    return form


def update_form(db: Session, form: Form, changes: FormUpdate) -> Form:
    if changes.title is not None:
        form.title = changes.title.strip()
    if changes.settings is not None:
        form.settings = changes.settings.model_dump()
    db.commit()
    return form


def delete_form(db: Session, form: Form) -> None:
    # A bulk DELETE lets the database cascade to questions, responses and answers in
    # one statement; deleting through the ORM would try to remove questions first
    # and trip over the answers that still reference them.
    db.execute(delete(Form).where(Form.id == form.id))
    db.commit()


def duplicate_form(db: Session, user: User, source: Form) -> Form:
    copy = Form(
        owner_id=user.id,
        title=f"Copy of {source.title}",
        slug=generate_slug(db),
        settings=dict(source.settings),
    )
    originals = source.live_questions
    for question in originals:
        copy.questions.append(clone_question(question, position=question.position))
    db.add(copy)
    db.flush()  # the copies now have ids, so logic rules can be pointed at them
    _remap_logic(originals, copy.live_questions)
    db.commit()
    return copy


def _remap_logic(originals: list[Question], copies: list[Question]) -> None:
    """A copied rule must refer to the copied questions and options, not the originals."""
    question_ids = {old.id: new.id for old, new in zip(originals, copies)}
    option_ids = {
        old_option.id: new_option.id
        for old, new in zip(originals, copies)
        for old_option, new_option in zip(old.options, new.options)
    }
    choice_ids = {q.id for q in originals if get_handler(q.type).logic_kind == "choice"}
    for copy in copies:
        logic = logic_service.logic_of(copy)
        if logic:
            copy.properties = {
                **copy.properties,
                logic_service.LOGIC_KEY: logic_service.remap_ids(logic, question_ids, option_ids, choice_ids),
            }


def clone_question(source: Question, position: int) -> Question:
    return Question(
        position=position,
        type=source.type,
        title=source.title,
        description=source.description,
        required=source.required,
        properties=dict(source.properties),
        options=[QuestionOption(position=o.position, label=o.label) for o in source.options],
    )


def publish_form(db: Session, form: Form) -> Form:
    if not form.live_questions:
        raise ValidationFailedError("Add at least one question before publishing")
    form.status = "published"
    form.published_at = utcnow()
    db.commit()
    return form


def unpublish_form(db: Session, form: Form) -> Form:
    form.status = "draft"
    db.commit()
    return form
