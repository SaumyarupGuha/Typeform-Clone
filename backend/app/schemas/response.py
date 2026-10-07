from typing import Literal

from pydantic import BaseModel, Field, JsonValue

from app.schemas.common import UtcDatetime
from app.schemas.form import ThankYouScreen
from app.schemas.question import QuestionOut


class StartResponseIn(BaseModel):
    metadata: dict[str, JsonValue] = Field(default_factory=dict)


class StartResponseOut(BaseModel):
    token: str


class AnswerIn(BaseModel):
    question_id: int
    value: JsonValue = None


class SubmitIn(BaseModel):
    answers: list[AnswerIn]


class ProgressIn(BaseModel):
    """Answers given so far, sent while the respondent is still filling the form in."""

    answers: list[AnswerIn]


class UploadedFileOut(BaseModel):
    """What the browser keeps as the answer to a file question, and sends back on submit."""

    file_id: int
    name: str
    size: int


class SubmitOut(BaseModel):
    thank_you_screen: ThankYouScreen


ResponseStatusFilter = Literal["completed", "partial", "all"]


class ResponseRowOut(BaseModel):
    """One response, completed or partial. `answers` maps question id (as a string) to a
    display-ready value: option labels instead of ids for choice questions."""

    id: int
    status: Literal["completed", "partial"]
    started_at: UtcDatetime
    submitted_at: UtcDatetime | None  # None while the response is still partial
    # The furthest question the respondent answered; where a partial response stopped.
    last_question_id: int | None
    answers: dict[str, JsonValue]


class ResponseListOut(BaseModel):
    items: list[ResponseRowOut]
    total: int
    page: int
    limit: int
    completed_count: int
    partial_count: int
    # Table columns: live questions plus soft-deleted ones that still have answers.
    questions: list[QuestionOut]


class ResponseAnswerOut(BaseModel):
    question: QuestionOut
    value: JsonValue


class ResponseDetailOut(BaseModel):
    id: int
    status: Literal["completed", "partial"]
    started_at: UtcDatetime
    submitted_at: UtcDatetime | None
    last_question_id: int | None
    answers: list[ResponseAnswerOut]
