from pydantic import JsonValue
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.answer import Answer
from app.models.file import UploadedFile
from app.models.question import Question
from app.models.response import Response
from app.question_types.base import AnswerColumns, Properties, QuestionTypeHandler, is_integer_like
from app.question_types.queries import completed_answers

LATEST_LIMIT = 5
MAX_SIZE_MB_LIMIT = 25
ALLOWED_TYPE_CHOICES = ("any", "images", "documents", "media")


def _file_id(value: JsonValue) -> int | None:
    """The file id inside an answer value, which looks like {"file_id": 12, "name": "cv.pdf", ...}."""
    if isinstance(value, dict):
        file_id = value.get("file_id")
        if is_integer_like(file_id) and isinstance(file_id, (int, float)):
            return int(file_id)
    return None


class FileUploadHandler(QuestionTypeHandler):
    """A file the respondent uploaded earlier; the answer value points at the stored file by id."""

    name = "file_upload"
    logic_kind = "file"
    default_properties: Properties = {"max_size_mb": 10, "allowed_types": "any"}

    def validate_properties(self, properties: Properties) -> str | None:
        size = properties.get("max_size_mb")
        if not is_integer_like(size) or not isinstance(size, (int, float)) or not 1 <= size <= MAX_SIZE_MB_LIMIT:
            return f"The maximum file size must be between 1 and {MAX_SIZE_MB_LIMIT} MB"
        if properties.get("allowed_types") not in ALLOWED_TYPE_CHOICES:
            return "Choose which kinds of file are allowed"
        return None

    def validate(self, question: Question, value: JsonValue) -> str | None:
        return None if _file_id(value) is not None else "Please upload a file"

    def validate_for_response(self, db: Session, response: Response, question: Question, value: JsonValue) -> str | None:
        stored = db.get(UploadedFile, _file_id(value) or 0)
        # The file must be the one uploaded for THIS question in THIS response.
        if stored is None or stored.response_id != response.id or stored.question_id != question.id:
            return "Please upload the file again"
        return None

    def columns_for_response(self, db: Session, response: Response, question: Question, value: JsonValue) -> AnswerColumns:
        stored = db.get(UploadedFile, _file_id(value) or 0)
        return AnswerColumns(text_value=stored.original_name if stored else None)

    def after_answer_saved(self, db: Session, answer: Answer, value: JsonValue) -> None:
        stored = db.get(UploadedFile, _file_id(value) or 0)
        if stored is not None:
            stored.answer_id = answer.id  # the file now belongs to this answer

    def to_columns(self, value: JsonValue) -> AnswerColumns:
        return AnswerColumns()  # the real columns come from the stored file: see columns_for_response

    def display_value(self, answer: Answer) -> JsonValue:
        stored = answer.file
        if stored is None:
            return answer.text_value
        return {
            "file_id": stored.id,
            "name": stored.original_name,
            "size": stored.size_bytes,
            "content_type": stored.content_type,
        }

    def stats(self, db: Session, question: Question) -> dict[str, JsonValue]:
        latest_query = (
            completed_answers(question.id).order_by(Response.submitted_at.desc(), Answer.id.desc()).limit(LATEST_LIMIT)
        )
        latest = [answer.text_value for answer in db.scalars(latest_query) if answer.text_value]
        total_bytes = (
            db.scalar(
                select(func.coalesce(func.sum(UploadedFile.size_bytes), 0))
                .join(Answer, Answer.id == UploadedFile.answer_id)
                .join(Response, Response.id == Answer.response_id)
                .where(UploadedFile.question_id == question.id, Response.status == "completed")
            )
            or 0
        )
        return {"total_bytes": int(total_bytes), "latest": list(latest)}
