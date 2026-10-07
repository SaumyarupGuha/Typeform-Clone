from pydantic import JsonValue
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.answer import Answer, AnswerOption
from app.models.question import Question
from app.models.response import Response
from app.question_types.base import AnswerColumns, Properties, QuestionTypeHandler, is_integer_like
from app.question_types.queries import count_answers, percent


class ChoiceHandler(QuestionTypeHandler):
    """Shared behaviour of multiple_choice and dropdown: answers live in `answer_options`."""

    has_options = True

    def display_value(self, answer: Answer) -> JsonValue:
        chosen = sorted(answer.answer_options, key=lambda link: link.option.position)
        return [link.option.label for link in chosen]

    def stats(self, db: Session, question: Question) -> dict[str, JsonValue]:
        counts_query = (
            select(AnswerOption.option_id, func.count())
            .join(Answer, Answer.id == AnswerOption.answer_id)
            .join(Response, Response.id == Answer.response_id)
            .where(Answer.question_id == question.id, Response.status == "completed")
            .group_by(AnswerOption.option_id)
        )
        counts = {option_id: count for option_id, count in db.execute(counts_query)}
        respondents = count_answers(db, question.id)
        options: list[JsonValue] = [
            {
                "option_id": option.id,
                "label": option.label,
                "count": counts.get(option.id, 0),
                "percent": percent(counts.get(option.id, 0), respondents),
            }
            for option in question.options
        ]
        return {"options": options}


class MultipleChoiceHandler(ChoiceHandler):
    name = "multiple_choice"
    logic_kind = "choice"
    default_properties: Properties = {"allow_multiple": False, "randomize": False, "vertical": True}

    def validate(self, question: Question, value: JsonValue) -> str | None:
        if not isinstance(value, list) or not all(is_integer_like(v) for v in value):
            return "Please choose from the options"
        chosen = [int(v) for v in value if isinstance(v, (int, float))]
        if len(set(chosen)) != len(chosen):
            return "Please choose each option only once"
        valid_ids = {option.id for option in question.options}
        if not set(chosen) <= valid_ids:
            return "Please choose from the options"
        if not question.properties.get("allow_multiple") and len(chosen) != 1:
            return "Please choose only one option"
        return None

    def to_columns(self, value: JsonValue) -> AnswerColumns:
        ids = tuple(int(v) for v in value if isinstance(v, (int, float))) if isinstance(value, list) else ()
        return AnswerColumns(option_ids=ids)


class DropdownHandler(ChoiceHandler):
    name = "dropdown"
    logic_kind = "choice"
    default_properties: Properties = {"placeholder": "Type or select an option", "alphabetical": False}

    def validate(self, question: Question, value: JsonValue) -> str | None:
        if not is_integer_like(value) or not isinstance(value, (int, float)):
            return "Please choose one of the options"
        if int(value) not in {option.id for option in question.options}:
            return "Please choose one of the options"
        return None

    def to_columns(self, value: JsonValue) -> AnswerColumns:
        return AnswerColumns(option_ids=(int(value),) if isinstance(value, (int, float)) else ())
