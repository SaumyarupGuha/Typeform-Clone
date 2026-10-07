from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.errors import ConflictError, NotFoundError, ValidationFailedError
from app.models.answer import Answer, AnswerOption
from app.models.file import UploadedFile
from app.models.form import Form
from app.models.question import Question, QuestionOption
from app.models.user import User
from app.question_types import get_handler, merge_properties
from app.schemas.question import OptionIn, QuestionCreate, QuestionUpdate
from app.services import logic_service
from app.services.form_service import clone_question

STARTER_OPTION_LABELS = ("Choice 1", "Choice 2")


def get_owned_question(db: Session, user: User, question_id: int) -> Question:
    query = (
        select(Question)
        .join(Form, Form.id == Question.form_id)
        .where(Question.id == question_id, Question.deleted_at.is_(None), Form.owner_id == user.id)
    )
    question = db.scalar(query)
    if question is None:
        raise NotFoundError("Question not found")
    return question


def _renumber(questions: list[Question]) -> None:
    for position, question in enumerate(questions):
        question.position = position


def _has_answers(db: Session, question_id: int) -> bool:
    # Files count too: an upload that was never submitted still references the question.
    has_answer = exists().where(Answer.question_id == question_id)
    has_file = exists().where(UploadedFile.question_id == question_id)
    return bool(db.scalar(select(has_answer | has_file)))


def _touch_form(question: Question) -> None:
    question.form.updated_at = utcnow()


def add_question(db: Session, form: Form, payload: QuestionCreate) -> Question:
    handler = get_handler(payload.type)
    question = Question(type=payload.type, properties=dict(handler.default_properties), position=0)
    if handler.has_options:
        question.options = [QuestionOption(position=i, label=label) for i, label in enumerate(STARTER_OPTION_LABELS)]

    ordered = form.live_questions
    position = len(ordered) if payload.position is None else min(payload.position, len(ordered))
    ordered.insert(position, question)
    form.questions.append(question)
    _renumber(ordered)
    form.updated_at = utcnow()
    db.commit()
    return question


def update_question(db: Session, question: Question, changes: QuestionUpdate) -> Question:
    fields = changes.model_dump(exclude_unset=True)

    if "type" in fields and fields["type"] is not None and fields["type"] != question.type:
        _change_type(db, question, fields["type"])
    handler = get_handler(question.type)

    if fields.get("title") is not None:
        question.title = fields["title"]
    if "description" in fields:
        question.description = fields["description"] or None
    if fields.get("required") is not None:
        question.required = fields["required"]
    if fields.get("properties") is not None:
        merged = merge_properties(handler, question.properties, fields["properties"])
        message = handler.validate_properties(merged)
        if message:
            raise ValidationFailedError(message, errors={"properties": message})
        question.properties = _keep_logic(question, merged)  # assign a new dict so SQLAlchemy sees the change
    if changes.options is not None:
        if not handler.has_options:
            raise ValidationFailedError("This question type has no options")
        _apply_options(db, question, changes.options)
    if changes.logic is not None:
        logic_service.validate_logic(question.form.live_questions, question, changes.logic)
        question.properties = {**question.properties, logic_service.LOGIC_KEY: changes.logic.model_dump()}

    _touch_form(question)
    db.commit()
    db.refresh(question)  # reload so `options` comes back in position order
    return question


def _keep_logic(question: Question, properties: dict) -> dict:
    """Type settings are replaced as a whole; the logic rules stored beside them must survive."""
    logic = question.properties.get(logic_service.LOGIC_KEY)
    return {**properties, logic_service.LOGIC_KEY: logic} if logic is not None else properties


def _change_type(db: Session, question: Question, new_type: str) -> None:
    if _has_answers(db, question.id):
        raise ConflictError("The type of a question that has responses cannot be changed")
    handler = get_handler(new_type)
    question.type = new_type
    question.properties = _keep_logic(question, dict(handler.default_properties))
    if handler.has_options and not question.options:
        question.options = [QuestionOption(position=i, label=label) for i, label in enumerate(STARTER_OPTION_LABELS)]
    if not handler.has_options:
        question.options.clear()


def _apply_options(db: Session, question: Question, options_in: list[OptionIn]) -> None:
    """Diff the submitted list against the stored options: keep (and rename) known
    ids, insert new ones, delete missing ones, then rewrite positions."""
    if not options_in:
        raise ValidationFailedError("A choice question needs at least one option")

    existing = {option.id: option for option in question.options}
    kept_ids: set[int] = set()
    for position, item in enumerate(options_in):
        if item.id is None:
            question.options.append(QuestionOption(position=position, label=item.label))
            continue
        option = existing.get(item.id)
        if option is None:
            raise ValidationFailedError(f"Option {item.id} does not belong to this question")
        option.label = item.label
        option.position = position
        kept_ids.add(item.id)

    for option_id, option in existing.items():
        if option_id in kept_ids:
            continue
        answered = db.scalar(select(exists().where(AnswerOption.option_id == option_id)))
        if answered:
            raise ConflictError(f'The option "{option.label}" has responses and cannot be removed')
        question.options.remove(option)  # delete-orphan cascade deletes the row


def delete_question(db: Session, question: Question) -> None:
    form = question.form
    logic_service.prune_references(form.live_questions, question.id)
    if _has_answers(db, question.id):
        question.deleted_at = utcnow()  # soft delete keeps old answers readable
    else:
        form.questions.remove(question)
    _renumber(form.live_questions)
    form.updated_at = utcnow()
    db.commit()


def duplicate_question(db: Session, question: Question) -> Question:
    form = question.form
    copy = clone_question(question, position=question.position + 1)
    ordered = form.live_questions
    ordered.insert(question.position + 1, copy)
    form.questions.append(copy)
    _renumber(ordered)
    form.updated_at = utcnow()
    db.commit()
    return copy


def reorder_questions(db: Session, form: Form, question_ids: list[int]) -> list[Question]:
    live = {question.id: question for question in form.live_questions}
    if len(question_ids) != len(set(question_ids)) or set(question_ids) != set(live):
        raise ValidationFailedError("The list must contain every question of the form exactly once")
    ordered = [live[question_id] for question_id in question_ids]
    _renumber(ordered)
    form.updated_at = utcnow()
    db.commit()
    return ordered
