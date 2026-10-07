import csv
import io

from pydantic import JsonValue
from sqlalchemy.orm import Session

from app.models.form import Form
from app.models.response import Response
from app.question_types import get_handler
from app.services.response_service import completed_responses_query, questions_for_results

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


def build_csv(db: Session, form: Form) -> str:
    questions = questions_for_results(db, form)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Submitted at", *[question.title or f"Question {question.id}" for question in questions]])

    query = completed_responses_query(form.id).order_by(Response.submitted_at.desc(), Response.id.desc())
    for response in db.scalars(query):
        answers = {answer.question_id: answer for answer in response.answers}
        row = [response.submitted_at.isoformat(sep=" ") if response.submitted_at else ""]
        for question in questions:
            answer = answers.get(question.id)
            value = get_handler(question.type).display_value(answer) if answer else None
            row.append(_cell(value))
        writer.writerow(row)
    return output.getvalue()
