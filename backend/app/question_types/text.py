from email_validator import EmailNotValidError, validate_email
from pydantic import JsonValue
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.answer import Answer
from app.models.question import Question
from app.models.response import Response
from app.question_types.base import AnswerColumns, Properties, QuestionTypeHandler
from app.question_types.queries import completed_answers

LATEST_LIMIT = 5


class TextHandler(QuestionTypeHandler):
    """Shared behaviour of short_text, long_text and email: one string in `text_value`."""

    default_max_length = 255

    def validate_properties(self, properties: Properties) -> str | None:
        max_length = properties.get("max_length", self.default_max_length)
        if isinstance(max_length, bool) or not isinstance(max_length, int) or max_length < 1:
            return "Max length must be a positive whole number"
        return None

    def validate(self, question: Question, value: JsonValue) -> str | None:
        if not isinstance(value, str):
            return "Please enter some text"
        max_length = question.properties.get("max_length", self.default_max_length)
        if len(value.strip()) > max_length:
            return f"Please keep this under {max_length} characters"
        return None

    def to_columns(self, value: JsonValue) -> AnswerColumns:
        return AnswerColumns(text_value=str(value).strip())

    def display_value(self, answer: Answer) -> JsonValue:
        return answer.text_value

    def stats(self, db: Session, question: Question) -> dict[str, JsonValue]:
        latest_query = (
            completed_answers(question.id)
            .order_by(Response.submitted_at.desc(), Answer.id.desc())
            .limit(LATEST_LIMIT)
        )
        latest = [a.text_value for a in db.scalars(latest_query) if a.text_value]
        return {"latest": list(latest)}


class ShortTextHandler(TextHandler):
    name = "short_text"
    default_properties: Properties = {"placeholder": "", "max_length": 255}
    default_max_length = 255


class LongTextHandler(TextHandler):
    name = "long_text"
    default_properties: Properties = {"placeholder": "", "max_length": 5000}
    default_max_length = 5000


class EmailHandler(TextHandler):
    name = "email"
    default_properties: Properties = {"placeholder": "name@example.com"}

    def validate_properties(self, properties: Properties) -> str | None:
        return None

    def validate(self, question: Question, value: JsonValue) -> str | None:
        if not isinstance(value, str):
            return "Please enter a valid email"
        try:
            # Syntax check only; looking up DNS records would make submits slow and flaky.
            validate_email(value.strip(), check_deliverability=False)
        except EmailNotValidError:
            return "Please enter a valid email"
        return None
