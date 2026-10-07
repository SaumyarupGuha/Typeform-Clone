from pydantic import JsonValue
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.answer import Answer
from app.models.question import Question
from app.question_types.base import AnswerColumns, Properties, QuestionTypeHandler
from app.question_types.queries import completed_answers


class YesNoHandler(QuestionTypeHandler):
    name = "yes_no"
    logic_kind = "boolean"
    default_properties: Properties = {}

    def validate(self, question: Question, value: JsonValue) -> str | None:
        if not isinstance(value, bool):
            return "Please choose Yes or No"
        return None

    def to_columns(self, value: JsonValue) -> AnswerColumns:
        return AnswerColumns(boolean_value=bool(value))

    def display_value(self, answer: Answer) -> JsonValue:
        return answer.boolean_value

    def stats(self, db: Session, question: Question) -> dict[str, JsonValue]:
        subquery = completed_answers(question.id).subquery()
        rows = db.execute(
            select(subquery.c.boolean_value, func.count()).group_by(subquery.c.boolean_value)
        ).all()
        counts = {bool(value): count for value, count in rows}
        return {"yes": counts.get(True, 0), "no": counts.get(False, 0)}
