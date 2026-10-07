"""Logic jumps: validating the rules a creator saves, and walking a form the way a respondent will.

Rules live in `question.properties["logic"]` (as plain JSON) so the database schema is unchanged.
"""

from typing import Any

from pydantic import JsonValue

from app.core.errors import ValidationFailedError
from app.models.question import Question
from app.question_types import get_handler
from app.question_types.logic import OPERATORS, evaluate_condition
from app.schemas.logic import LogicConfig

END = "end"
LOGIC_KEY = "logic"
_NO_VALUE_OPERATORS = ("is_answered", "is_not_answered")


def logic_of(question: Question) -> dict[str, Any]:
    raw = question.properties.get(LOGIC_KEY)
    return raw if isinstance(raw, dict) else {}


# ---------- Walking a form ----------


def _rule_matches(rule: dict[str, Any], questions_by_id: dict[int, Question], answers: dict[int, JsonValue]) -> bool:
    results: list[bool] = []
    for condition in rule.get("conditions", []):
        source = questions_by_id.get(condition.get("question_id"))
        if source is None:
            results.append(False)  # the question it depended on is gone
            continue
        kind = get_handler(source.type).logic_kind
        results.append(
            evaluate_condition(kind, str(condition.get("operator")), condition.get("value"), answers.get(source.id))
        )
    if not results:
        return False
    return all(results) if rule.get("match", "all") == "all" else any(results)


def next_index(questions: list[Question], index: int, answers: dict[int, JsonValue]) -> int | None:
    """Where the respondent goes after `questions[index]`.

    Returns the next question's index, or None when the form ends (a jump to the end, or
    the last question). Only forward jumps are honoured, so a form can never loop.
    `answers` must only contain answers to questions already visited.
    """
    position = {q.id: i for i, q in enumerate(questions)}
    by_id = {q.id: q for q in questions}
    logic = logic_of(questions[index])

    target: Any = None
    for rule in logic.get("rules", []):
        if _rule_matches(rule, by_id, answers):
            target = rule.get("jump_to")
            break
    else:
        target = logic.get("otherwise")

    if target == END:
        return None
    if isinstance(target, int) and position.get(target, -1) > index:
        return position[target]
    return index + 1 if index + 1 < len(questions) else None


def compute_path(questions: list[Question], answers: dict[int, JsonValue]) -> list[Question]:
    """The questions a respondent sees, in order, given their answers.

    Questions skipped by a jump are not on the path, and any answer they hold (for example
    one given before the respondent changed an earlier answer) is ignored.
    """
    path: list[Question] = []
    visible: dict[int, JsonValue] = {}
    index: int | None = 0 if questions else None
    while index is not None:
        question = questions[index]
        path.append(question)
        if question.id in answers:
            visible[question.id] = answers[question.id]
        index = next_index(questions, index, visible)
    return path


# ---------- Validating what a creator saves ----------


def _value_error(kind: str, operator: str, value: JsonValue, source: Question) -> str | None:
    if operator in _NO_VALUE_OPERATORS:
        return None
    if kind == "text":
        return None if isinstance(value, str) else "Enter the text to compare with"
    if kind == "number":
        ok = isinstance(value, (int, float)) and not isinstance(value, bool)
        return None if ok else "Enter a number to compare with"
    if kind == "boolean":
        return None if isinstance(value, bool) else "Choose Yes or No"
    valid_ids = {option.id for option in source.options}  # choice
    ok = isinstance(value, int) and not isinstance(value, bool) and value in valid_ids
    return None if ok else "Choose one of the question's options"


def validate_logic(questions: list[Question], question: Question, config: LogicConfig) -> None:
    """Raises ValidationFailedError when a rule refers to something that cannot work.

    Conditions may only look at this question or earlier ones (later questions have not been
    answered yet), and jumps may only go forward (so a form can never loop).
    """
    position = {q.id: i for i, q in enumerate(questions)}
    by_id = {q.id: q for q in questions}
    here = position[question.id]

    def fail(message: str) -> None:
        raise ValidationFailedError(message, errors={LOGIC_KEY: message})

    def check_target(target: int | str, label: str) -> None:
        if target == END:
            return
        if not isinstance(target, int) or target not in position:
            fail(f"{label}: the question to jump to does not exist")
        elif position[target] <= here:
            fail(f"{label}: you can only jump to a question further down the form")

    for number, rule in enumerate(config.rules, start=1):
        label = f"Rule {number}"
        for condition in rule.conditions:
            source = by_id.get(condition.question_id)
            if source is None or position[source.id] > here:
                fail(f"{label}: a condition can only use this question or an earlier one")
                continue
            kind = get_handler(source.type).logic_kind
            if condition.operator not in OPERATORS[kind]:
                fail(f"{label}: \"{condition.operator}\" does not apply to {source.type} questions")
            message = _value_error(kind, condition.operator, condition.value, source)
            if message:
                fail(f"{label}: {message}")
        check_target(rule.jump_to, label)
    if config.otherwise is not None:
        check_target(config.otherwise, "All other cases")


# ---------- Keeping references valid ----------


def prune_references(questions: list[Question], removed_id: int) -> None:
    """After a question is deleted, drop every rule that conditions on it or jumps to it."""
    for question in questions:
        logic = logic_of(question)
        if not logic or question.id == removed_id:
            continue
        rules = [
            rule
            for rule in logic.get("rules", [])
            if rule.get("jump_to") != removed_id
            and all(c.get("question_id") != removed_id for c in rule.get("conditions", []))
        ]
        otherwise = None if logic.get("otherwise") == removed_id else logic.get("otherwise")
        if rules != logic.get("rules", []) or otherwise != logic.get("otherwise"):
            question.properties = {**question.properties, LOGIC_KEY: {"rules": rules, "otherwise": otherwise}}


def remap_ids(
    logic: dict[str, Any],
    question_ids: dict[int, int],
    option_ids: dict[int, int],
    choice_question_ids: set[int],
) -> dict[str, Any]:
    """Rewrite a rule set for a copied form: every question and option id points at its copy.

    Only conditions on choice questions hold option ids; a number or text value must be left alone.
    """

    def target(value: Any) -> Any:
        return question_ids.get(value, value) if isinstance(value, int) else value

    rules = []
    for rule in logic.get("rules", []):
        conditions = []
        for condition in rule.get("conditions", []):
            value = condition.get("value")
            source_id = condition.get("question_id")
            if source_id in choice_question_ids and isinstance(value, int) and not isinstance(value, bool):
                value = option_ids.get(value, value)
            conditions.append({**condition, "question_id": question_ids.get(source_id, source_id), "value": value})
        rules.append({**rule, "conditions": conditions, "jump_to": target(rule.get("jump_to"))})
    return {"rules": rules, "otherwise": target(logic.get("otherwise"))}
