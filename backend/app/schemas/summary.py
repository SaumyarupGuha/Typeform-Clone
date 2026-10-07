from pydantic import BaseModel, JsonValue


class QuestionSummaryOut(BaseModel):
    question_id: int
    title: str
    type: str
    answered: int
    # Shape depends on the question type; see each handler's `stats` method.
    stats: dict[str, JsonValue]


class FunnelStepOut(BaseModel):
    """One question in the drop-off funnel."""

    question_id: int
    title: str
    answered: int  # responses (completed and partial) that answered it
    left_here: int  # partial responses whose last answer was this question


class SummaryOut(BaseModel):
    started: int
    completed: int
    partial: int
    completion_rate: float
    avg_seconds: float | None
    # Partial responses that never answered anything: they left before the first question.
    left_before_first: int
    funnel: list[FunnelStepOut]
    questions: list[QuestionSummaryOut]
