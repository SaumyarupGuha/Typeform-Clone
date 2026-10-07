from pydantic import BaseModel, JsonValue


class QuestionSummaryOut(BaseModel):
    question_id: int
    title: str
    type: str
    answered: int
    # Shape depends on the question type; see each handler's `stats` method.
    stats: dict[str, JsonValue]


class SummaryOut(BaseModel):
    started: int
    completed: int
    completion_rate: float
    avg_seconds: float | None
    questions: list[QuestionSummaryOut]
