import csv
import io

from pydantic import JsonValue
from sqlalchemy.orm import Session

from app.models.form import Form
from app.question_types import get_handler
from app.schemas.response import ResponseStatusFilter
from app.services.response_service import PUBLIC_STATUS, newest_first, questions_for_results, responses_query

_FORMULA_PREFIXES = ("=", "+", "-", "@")


def _cell(value: JsonValue) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, (int, float)):
        return str(value)  # numbers are safe, and a negative number must stay a number
    text = ", ".join(str(item) for item in value) if isinstance(value, list) else str(value)
    # Spreadsheet apps execute text cells that start with these characters as formulas.
    return f"'{text}" if text.startswith(_FORMULA_PREFIXES) else text


def build_csv(db: Session, form: Form, status: ResponseStatusFilter = "completed") -> str:
    """One row per response. Completed-only keeps the simple layout; including partial responses
    adds a Status column and uses the start time for responses that were never submitted."""
    questions = questions_for_results(db, form)
    with_status = status != "completed"
    output = io.StringIO()
    writer = csv.writer(output)
    header = ["Status", "Date"] if with_status else ["Submitted at"]
    writer.writerow([*header, *[question.title or f"Question {question.id}" for question in questions]])

    for response in db.scalars(newest_first(responses_query(form.id, status))):
        answers = {answer.question_id: answer for answer in response.answers}
        moment = response.submitted_at or response.started_at
        row = [moment.isoformat(sep=" ") if moment else ""]
        if with_status:
            row.insert(0, PUBLIC_STATUS[response.status].capitalize())
        for question in questions:
            answer = answers.get(question.id)
            value = get_handler(question.type).display_value(answer) if answer else None
            row.append(_cell(value))
        writer.writerow(row)
    return output.getvalue()
