import math

from pydantic import JsonValue
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.answer import Answer
from app.models.question import Question
from app.question_types.base import AnswerColumns, Properties, QuestionTypeHandler, is_integer_like
from app.question_types.queries import completed_answers, count_answers

MIN_RATING_STEPS = 3
MAX_RATING_STEPS = 10


def _whole_if_possible(number: float | None) -> float | int | None:
    """4.0 -> 4 so JSON shows whole numbers the way the respondent typed them."""
    if number is not None and float(number).is_integer():
        return int(number)
    return number


class NumberHandler(QuestionTypeHandler):
    name = "number"
    logic_kind = "number"
    default_properties: Properties = {"min": None, "max": None}

    def validate_properties(self, properties: Properties) -> str | None:
        low, high = properties.get("min"), properties.get("max")
        for bound in (low, high):
            if bound is not None and (isinstance(bound, bool) or not isinstance(bound, (int, float))):
                return "Min and max must be numbers"
        if isinstance(low, (int, float)) and isinstance(high, (int, float)) and low > high:
            return "Min cannot be greater than max"
        return None

    def validate(self, question: Question, value: JsonValue) -> str | None:
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            return "Please enter a number"
        low = question.properties.get("min")
        high = question.properties.get("max")
        if low is not None and high is not None and not low <= value <= high:
            return f"Please enter a number between {_whole_if_possible(low)} and {_whole_if_possible(high)}"
        if low is not None and value < low:
            return f"Please enter a number that is at least {_whole_if_possible(low)}"
        if high is not None and value > high:
            return f"Please enter a number that is at most {_whole_if_possible(high)}"
        return None

    def to_columns(self, value: JsonValue) -> AnswerColumns:
        return AnswerColumns(number_value=float(value) if isinstance(value, (int, float)) else None)

    def display_value(self, answer: Answer) -> JsonValue:
        return _whole_if_possible(answer.number_value)

    def stats(self, db: Session, question: Question) -> dict[str, JsonValue]:
        subquery = completed_answers(question.id).subquery()
        low, high, average = db.execute(
            select(
                func.min(subquery.c.number_value),
                func.max(subquery.c.number_value),
                func.avg(subquery.c.number_value),
            )
        ).one()
        return {
            "min": _whole_if_possible(low),
            "max": _whole_if_possible(high),
            "average": round(average, 2) if average is not None else None,
        }


class RatingHandler(QuestionTypeHandler):
    name = "rating"
    logic_kind = "number"
    default_properties: Properties = {"steps": 5, "shape": "star"}

    def validate_properties(self, properties: Properties) -> str | None:
        steps = properties.get("steps")
        if not is_integer_like(steps) or not isinstance(steps, (int, float)):
            return "Steps must be a whole number"
        if not MIN_RATING_STEPS <= steps <= MAX_RATING_STEPS:
            return f"Steps must be between {MIN_RATING_STEPS} and {MAX_RATING_STEPS}"
        return None

    def validate(self, question: Question, value: JsonValue) -> str | None:
        steps = int(question.properties.get("steps", 5))
        if not is_integer_like(value) or not isinstance(value, (int, float)) or not 1 <= value <= steps:
            return f"Please choose a rating from 1 to {steps}"
        return None

    def to_columns(self, value: JsonValue) -> AnswerColumns:
        return AnswerColumns(number_value=float(value) if isinstance(value, (int, float)) else None)

    def display_value(self, answer: Answer) -> JsonValue:
        return _whole_if_possible(answer.number_value)

    def stats(self, db: Session, question: Question) -> dict[str, JsonValue]:
        steps = int(question.properties.get("steps", 5))
        subquery = completed_answers(question.id).subquery()
        rows = db.execute(
            select(subquery.c.number_value, func.count()).group_by(subquery.c.number_value)
        ).all()
        counts = {int(value): count for value, count in rows}
        total = count_answers(db, question.id)
        weighted_sum = sum(value * count for value, count in counts.items())
        distribution: list[JsonValue] = [
            {"value": step, "count": counts.get(step, 0)} for step in range(1, steps + 1)
        ]
        return {
            "steps": steps,
            "average": round(weighted_sum / total, 2) if total else None,
            "distribution": distribution,
        }
