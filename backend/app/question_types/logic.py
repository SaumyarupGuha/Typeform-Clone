"""Conditions for logic jumps: which operators each kind of question supports, and how they are evaluated.

Every question type declares one `logic_kind` (text, number, choice, boolean or file) and gets
the matching operators for free. The frontend mirrors this file in lib/logic.ts, so a
branch is decided identically in the browser (to show the next screen) and on the server
(to know which required questions were skipped).
"""

from typing import Literal

from pydantic import JsonValue

LogicKind = Literal["text", "number", "choice", "boolean", "file"]

_ANSWERED = ("is_answered", "is_not_answered")

OPERATORS: dict[str, tuple[str, ...]] = {
    "text": ("is", "is_not", "contains", "not_contains", "begins_with", "ends_with", *_ANSWERED),
    "number": ("is", "is_not", "greater_than", "greater_or_equal", "less_than", "less_or_equal", *_ANSWERED),
    "choice": ("is", "is_not", *_ANSWERED),
    "boolean": ("is", "is_not", *_ANSWERED),
    "file": _ANSWERED,  # a file can only be present or absent
}

ALL_OPERATORS = tuple(dict.fromkeys(op for ops in OPERATORS.values() for op in ops))


def has_answer(value: JsonValue | None) -> bool:
    """False for no answer; False (yes/no) and 0 count as answers."""
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() != ""
    if isinstance(value, list):
        return len(value) > 0
    return True


def _is_number(value: JsonValue | None) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def evaluate_condition(kind: str, operator: str, expected: JsonValue | None, actual: JsonValue | None) -> bool:
    """Does `actual` (what the respondent answered) satisfy `operator expected`?"""
    if operator == "is_answered":
        return has_answer(actual)
    if operator == "is_not_answered":
        return not has_answer(actual)
    if operator not in OPERATORS.get(kind, ()):
        return False  # an operator that does not suit this kind never matches

    if not has_answer(actual):
        # An unanswered question is "not" anything, and matches nothing else.
        return operator in ("is_not", "not_contains")

    if kind == "text":
        return _text(operator, str(expected or ""), str(actual))
    if kind == "number":
        return _number(operator, expected, actual)
    if kind == "choice":
        chosen = actual if isinstance(actual, list) else [actual]  # multi-select: "is" means "includes"
        found = expected in chosen
        return found if operator == "is" else not found
    # boolean
    same = isinstance(actual, bool) and actual == expected
    return same if operator == "is" else not same


def _text(operator: str, expected: str, actual: str) -> bool:
    expected, actual = expected.strip().casefold(), actual.strip().casefold()
    if operator == "is":
        return actual == expected
    if operator == "is_not":
        return actual != expected
    if operator == "contains":
        return expected in actual
    if operator == "not_contains":
        return expected not in actual
    if operator == "begins_with":
        return actual.startswith(expected)
    return actual.endswith(expected)  # ends_with


def _number(operator: str, expected: JsonValue | None, actual: JsonValue | None) -> bool:
    if not _is_number(expected) or not _is_number(actual):
        return operator == "is_not"
    assert isinstance(expected, (int, float)) and isinstance(actual, (int, float))
    comparisons = {
        "is": actual == expected,
        "is_not": actual != expected,
        "greater_than": actual > expected,
        "greater_or_equal": actual >= expected,
        "less_than": actual < expected,
        "less_or_equal": actual <= expected,
    }
    return comparisons[operator]
