"""Contract every question type implements.

A type is defined once here on the backend (the frontend mirrors it in
lib/questionTypes.tsx). Submit validation, answer storage, result display and
summary stats all go through this interface, so there is no `if type == ...`
branching anywhere else in the backend.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass

from pydantic import JsonValue
from sqlalchemy.orm import Session

from app.models.answer import Answer
from app.models.question import Question
from app.models.response import Response

Properties = dict[str, JsonValue]


@dataclass(frozen=True)
class AnswerColumns:
    """How one answer maps onto the typed columns of the `answers` table."""

    text_value: str | None = None
    number_value: float | None = None
    boolean_value: bool | None = None
    option_ids: tuple[int, ...] = ()


class QuestionTypeHandler(ABC):
    name: str
    default_properties: Properties
    has_options: bool = False
    # Picks the operators available in logic jumps (see question_types/logic.py).
    logic_kind: str

    def is_empty(self, value: JsonValue) -> bool:
        """True when the respondent gave no answer. False (yes/no) and 0 are real answers."""
        if value is None:
            return True
        if isinstance(value, str):
            return value.strip() == ""
        if isinstance(value, list):
            return len(value) == 0
        return False

    def validate_properties(self, properties: Properties) -> str | None:
        """Return an error message if the creator's settings are invalid, else None."""
        return None

    @abstractmethod
    def validate(self, question: Question, value: JsonValue) -> str | None:
        """Check a non-empty answer. Returns an error message, or None when valid."""

    @abstractmethod
    def to_columns(self, value: JsonValue) -> AnswerColumns:
        """Convert a validated answer into column values."""

    # --- Hooks for the few types whose answer points at stored data (a file). Most types ignore them. ---

    def validate_for_response(self, db: Session, response: Response, question: Question, value: JsonValue) -> str | None:
        """Extra check that needs the database and the response (for example that a file belongs to it)."""
        return None

    def columns_for_response(self, db: Session, response: Response, question: Question, value: JsonValue) -> AnswerColumns:
        """Like `to_columns`, for types that must look at stored data."""
        return self.to_columns(value)

    def after_answer_saved(self, db: Session, answer: Answer, value: JsonValue) -> None:
        """Runs once the answer row exists and has an id."""
        return None

    @abstractmethod
    def display_value(self, answer: Answer) -> JsonValue:
        """Human-readable value for the responses table, drawer and CSV."""

    @abstractmethod
    def stats(self, db: Session, question: Question) -> dict[str, JsonValue]:
        """Aggregate completed answers for the Summary tab."""


def is_integer_like(value: JsonValue) -> bool:
    """True for ints and whole floats (JSON may deliver 4 as 4.0). Excludes bool,
    which is a subclass of int in Python."""
    if isinstance(value, bool):
        return False
    if isinstance(value, int):
        return True
    return isinstance(value, float) and value.is_integer()
