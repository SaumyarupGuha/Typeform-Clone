from typing import Literal

from pydantic import BaseModel, Field, JsonValue

LogicOperator = Literal[
    "is",
    "is_not",
    "contains",
    "not_contains",
    "begins_with",
    "ends_with",
    "greater_than",
    "greater_or_equal",
    "less_than",
    "less_or_equal",
    "is_answered",
    "is_not_answered",
]

# Where a jump lands: a question id, or "end" for the thank-you screen.
JumpTarget = int | Literal["end"]


class LogicCondition(BaseModel):
    question_id: int
    operator: LogicOperator
    value: JsonValue = None  # ignored by is_answered / is_not_answered


class LogicRule(BaseModel):
    """"If all (or any) of these conditions hold, jump to `jump_to`"."""

    match: Literal["all", "any"] = "all"
    conditions: list[LogicCondition] = Field(min_length=1, max_length=10)
    jump_to: JumpTarget


class LogicConfig(BaseModel):
    """The branching attached to one question. Rules are tried in order; the first match wins."""

    rules: list[LogicRule] = Field(default_factory=list, max_length=20)
    # Where to go when no rule matches. None means "the next question", the normal flow.
    otherwise: JumpTarget | None = None
