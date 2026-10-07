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


class SubmitOut(BaseModel):
    thank_you_screen: ThankYouScreen


class ResponseRowOut(BaseModel):
    """One completed response. `answers` maps question id (as a string) to a
    display-ready value: option labels instead of ids for choice questions."""

    id: int
    submitted_at: UtcDatetime
    answers: dict[str, JsonValue]


class ResponseListOut(BaseModel):
    items: list[ResponseRowOut]
    total: int
    page: int
    limit: int
    # Table columns: live questions plus soft-deleted ones that still have answers.
    questions: list[QuestionOut]


class ResponseAnswerOut(BaseModel):
    question: QuestionOut
    value: JsonValue


class ResponseDetailOut(BaseModel):
    id: int
    started_at: UtcDatetime
    submitted_at: UtcDatetime
    answers: list[ResponseAnswerOut]
