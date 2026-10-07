from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.question_types.logic import evaluate_condition
from tests.conftest import add_question, create_form, publish, start, submit


# ---------- operator evaluation ----------


@pytest.mark.parametrize(
    ("kind", "operator", "expected", "actual", "result"),
    [
        ("text", "is", "Yes", "yes ", True),  # case and surrounding spaces are ignored
        ("text", "is_not", "yes", "no", True),
        ("text", "contains", "ell", "Hello", True),
        ("text", "not_contains", "xyz", "Hello", True),
        ("text", "begins_with", "he", "Hello", True),
        ("text", "ends_with", "LO", "Hello", True),
        ("text", "contains", "x", "Hello", False),
        ("number", "greater_than", 5, 6, True),
        ("number", "greater_than", 5, 5, False),
        ("number", "greater_or_equal", 5, 5, True),
        ("number", "less_than", 5, 4.5, True),
        ("number", "less_or_equal", 5, 6, False),
        ("number", "is", 3, 3.0, True),
        ("number", "is_not", 3, 4, True),
        ("choice", "is", 7, 7, True),
        ("choice", "is", 7, [3, 7], True),  # multi-select: "is" means "includes"
        ("choice", "is_not", 7, [3], True),
        ("choice", "is_not", 7, [7], False),
        ("boolean", "is", True, True, True),
        ("boolean", "is", False, False, True),  # "No" is an answer, not an empty one
        ("boolean", "is_not", True, False, True),
        ("text", "is_answered", None, "x", True),
        ("number", "is_answered", None, 0, True),  # 0 counts as answered
        ("boolean", "is_answered", None, False, True),
        ("text", "is_not_answered", None, "  ", True),
        ("choice", "is_not_answered", None, [], True),
    ],
)
def test_evaluate_condition(kind: str, operator: str, expected: Any, actual: Any, result: bool) -> None:
    assert evaluate_condition(kind, operator, expected, actual) is result


def test_unanswered_question_matches_negative_operators_only() -> None:
    assert evaluate_condition("choice", "is", 1, None) is False
    assert evaluate_condition("choice", "is_not", 1, None) is True
    assert evaluate_condition("number", "greater_than", 1, None) is False
    assert evaluate_condition("text", "not_contains", "x", None) is True


def test_operator_from_another_kind_never_matches() -> None:
    assert evaluate_condition("boolean", "greater_than", 1, True) is False


# ---------- helpers ----------


def cond(question: dict[str, Any], operator: str, value: Any = None) -> dict[str, Any]:
    return {"question_id": question["id"], "operator": operator, "value": value}


def rule(conditions: list[dict[str, Any]], jump_to: Any, match: str = "all") -> dict[str, Any]:
    return {"match": match, "conditions": conditions, "jump_to": jump_to}


def set_logic(client: TestClient, question: dict[str, Any], rules: list[dict[str, Any]], otherwise: Any = None) -> Any:
    return client.patch(f"/api/questions/{question['id']}", json={"logic": {"rules": rules, "otherwise": otherwise}})


def three_question_form(client: TestClient) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Q1 yes/no, Q2 required text, Q3 required text."""
    form = create_form(client)
    q1 = add_question(client, form["id"], "yes_no", title="Q1")
    q2 = add_question(client, form["id"], "short_text", title="Q2", required=True)
    q3 = add_question(client, form["id"], "short_text", title="Q3", required=True)
    return form, [q1, q2, q3]


# ---------- saving rules ----------


def test_logic_round_trips_and_stays_out_of_properties(client: TestClient) -> None:
    form, (q1, q2, q3) = three_question_form(client)
    response = set_logic(client, q1, [rule([cond(q1, "is", False)], q3["id"])], otherwise="end")
    assert response.status_code == 200, response.text

    stored = client.get(f"/api/forms/{form['id']}").json()["questions"][0]
    assert stored["logic"]["rules"][0]["jump_to"] == q3["id"]
    assert stored["logic"]["otherwise"] == "end"
    assert "logic" not in stored["properties"]


def test_new_questions_have_empty_logic(client: TestClient) -> None:
    form, (q1, _, _) = three_question_form(client)
    assert q1["logic"] == {"rules": [], "otherwise": None}


def test_updating_settings_or_type_keeps_logic(client: TestClient) -> None:
    form, (q1, q2, q3) = three_question_form(client)
    set_logic(client, q2, [rule([cond(q2, "is_answered")], q3["id"])])

    client.patch(f"/api/questions/{q2['id']}", json={"properties": {"max_length": 50}})
    client.patch(f"/api/questions/{q2['id']}", json={"type": "email"})

    saved = client.get(f"/api/forms/{form['id']}").json()["questions"][1]
    assert saved["logic"]["rules"][0]["jump_to"] == q3["id"]
    assert saved["type"] == "email"


@pytest.mark.parametrize(
    ("name", "build", "fragment"),
    [
        ("jump backwards", lambda q1, q2, q3: rule([cond(q2, "is_answered")], q1["id"]), "further down"),
        ("jump to itself", lambda q1, q2, q3: rule([cond(q2, "is_answered")], q2["id"]), "further down"),
        ("jump to a missing question", lambda q1, q2, q3: rule([cond(q2, "is_answered")], 99999), "does not exist"),
        ("condition on a later question", lambda q1, q2, q3: rule([cond(q3, "is_answered")], "end"), "earlier one"),
        ("operator that does not suit the kind", lambda q1, q2, q3: rule([cond(q2, "greater_than", 3)], "end"), "does not apply"),
        ("wrong value type", lambda q1, q2, q3: rule([cond(q1, "is", "yes")], "end"), "Yes or No"),
    ],
)
def test_invalid_rules_are_rejected_with_a_message(client: TestClient, name: str, build: Any, fragment: str) -> None:
    form, (q1, q2, q3) = three_question_form(client)
    response = set_logic(client, q2, [build(q1, q2, q3)])
    assert response.status_code == 422, name
    detail = response.json()["detail"]
    assert fragment in detail["errors"]["logic"], detail
    assert client.get(f"/api/forms/{form['id']}").json()["questions"][1]["logic"]["rules"] == []  # nothing saved


def test_choice_condition_must_use_an_option_of_that_question(client: TestClient) -> None:
    form = create_form(client)
    choice = add_question(client, form["id"], "multiple_choice", title="Pick")
    other = add_question(client, form["id"], "multiple_choice", title="Other")
    last = add_question(client, form["id"], "short_text", title="Last")

    wrong = set_logic(client, choice, [rule([cond(choice, "is", other["options"][0]["id"])], last["id"])])
    assert wrong.status_code == 422
    right = set_logic(client, choice, [rule([cond(choice, "is", choice["options"][0]["id"])], last["id"])])
    assert right.status_code == 200


# ---------- following rules while answering ----------


def test_jump_skips_a_required_question_and_ignores_its_answer(client: TestClient) -> None:
    form, (q1, q2, q3) = three_question_form(client)
    set_logic(client, q1, [rule([cond(q1, "is", False)], q3["id"])])
    slug = publish(client, form["id"])["slug"]

    # No: Q2 is skipped, so being "required" does not block the submit.
    token = start(client, slug)
    response = submit(client, slug, token, [{"question_id": q1["id"], "value": False}, {"question_id": q3["id"], "value": "c"}])
    assert response.status_code == 201, response.text
    answers = client.get(f"/api/forms/{form['id']}/responses").json()["items"][0]["answers"]
    assert str(q2["id"]) not in answers

    # An answer given to a skipped question (kept by a client that went back) is dropped.
    token = start(client, slug)
    submit(client, slug, token, [
        {"question_id": q1["id"], "value": False},
        {"question_id": q2["id"], "value": "stale"},
        {"question_id": q3["id"], "value": "c"},
    ])
    newest = client.get(f"/api/forms/{form['id']}/responses").json()["items"][0]["answers"]
    assert str(q2["id"]) not in newest


def test_the_other_branch_still_enforces_required(client: TestClient) -> None:
    form, (q1, q2, q3) = three_question_form(client)
    set_logic(client, q1, [rule([cond(q1, "is", False)], q3["id"])])
    slug = publish(client, form["id"])["slug"]

    response = submit(client, slug, start(client, slug), [{"question_id": q1["id"], "value": True}, {"question_id": q3["id"], "value": "c"}])
    assert response.status_code == 422
    assert response.json()["detail"]["errors"] == {str(q2["id"]): "This question is required"}


def test_jump_to_end_skips_everything_after(client: TestClient) -> None:
    form, (q1, q2, q3) = three_question_form(client)
    set_logic(client, q1, [rule([cond(q1, "is", False)], "end")])
    slug = publish(client, form["id"])["slug"]
    response = submit(client, slug, start(client, slug), [{"question_id": q1["id"], "value": False}])
    assert response.status_code == 201


def test_otherwise_applies_when_no_rule_matches(client: TestClient) -> None:
    form, (q1, q2, q3) = three_question_form(client)
    set_logic(client, q1, [rule([cond(q1, "is", True)], q2["id"])], otherwise=q3["id"])
    slug = publish(client, form["id"])["slug"]
    ok = submit(client, slug, start(client, slug), [{"question_id": q1["id"], "value": False}, {"question_id": q3["id"], "value": "c"}])
    assert ok.status_code == 201


def test_any_and_all_matching(client: TestClient) -> None:
    form = create_form(client)
    a = add_question(client, form["id"], "yes_no", title="A")
    b = add_question(client, form["id"], "yes_no", title="B")
    skipped = add_question(client, form["id"], "short_text", title="Skipped", required=True)
    end = add_question(client, form["id"], "short_text", title="End")
    set_logic(client, b, [rule([cond(a, "is", True), cond(b, "is", True)], end["id"], match="any")])
    slug = publish(client, form["id"])["slug"]

    # A is yes, B is no: "any" matches, so the required question is skipped.
    one = submit(client, slug, start(client, slug), [{"question_id": a["id"], "value": True}, {"question_id": b["id"], "value": False}])
    assert one.status_code == 201

    # Neither is yes: nothing matches, so the required question must be answered.
    none = submit(client, slug, start(client, slug), [{"question_id": a["id"], "value": False}, {"question_id": b["id"], "value": False}])
    assert none.status_code == 422
    assert str(skipped["id"]) in none.json()["detail"]["errors"]


def test_a_backward_jump_left_by_reordering_is_ignored(client: TestClient) -> None:
    form, (q1, q2, q3) = three_question_form(client)
    set_logic(client, q1, [rule([cond(q1, "is", False)], q3["id"])])
    client.put(f"/api/forms/{form['id']}/questions/order", json={"question_ids": [q3["id"], q1["id"], q2["id"]]})
    slug = publish(client, form["id"])["slug"]

    # Q3 now comes first, so the jump to it points backwards and is skipped: Q2 is required again.
    response = submit(client, slug, start(client, slug), [
        {"question_id": q3["id"], "value": "c"},
        {"question_id": q1["id"], "value": False},
    ])
    assert response.status_code == 422
    assert str(q2["id"]) in response.json()["detail"]["errors"]


# ---------- keeping rules valid ----------


def test_deleting_a_question_removes_rules_that_use_it(client: TestClient) -> None:
    form, (q1, q2, q3) = three_question_form(client)
    set_logic(
        client, q1,
        [rule([cond(q1, "is", False)], q2["id"]), rule([cond(q1, "is", True)], q3["id"])],
        otherwise=q2["id"],
    )
    client.delete(f"/api/questions/{q2['id']}")

    logic = client.get(f"/api/forms/{form['id']}").json()["questions"][0]["logic"]
    assert [r["jump_to"] for r in logic["rules"]] == [q3["id"]]
    assert logic["otherwise"] is None


def test_duplicating_a_form_points_rules_at_the_copies(client: TestClient) -> None:
    form = create_form(client)
    choice = add_question(client, form["id"], "multiple_choice", title="Pick")
    middle = add_question(client, form["id"], "short_text", title="Middle")
    last = add_question(client, form["id"], "short_text", title="Last")
    set_logic(client, choice, [rule([cond(choice, "is", choice["options"][1]["id"])], last["id"])])

    copy = client.post(f"/api/forms/{form['id']}/duplicate").json()
    copied_choice, _, copied_last = copy["questions"]
    saved = copied_choice["logic"]["rules"][0]

    assert saved["jump_to"] == copied_last["id"] != last["id"]
    assert saved["conditions"][0]["question_id"] == copied_choice["id"]
    assert saved["conditions"][0]["value"] == copied_choice["options"][1]["id"]
    assert saved["conditions"][0]["value"] not in [o["id"] for o in choice["options"]]


def test_duplicating_a_form_does_not_rewrite_number_values(client: TestClient) -> None:
    form = create_form(client)
    rating = add_question(client, form["id"], "rating", title="Rate")
    last = add_question(client, form["id"], "short_text", title="Last")
    # The value 1 equals some option id elsewhere; a number condition must keep it as-is.
    set_logic(client, rating, [rule([cond(rating, "less_or_equal", 1)], last["id"])])
    copy = client.post(f"/api/forms/{form['id']}/duplicate").json()
    assert copy["questions"][0]["logic"]["rules"][0]["conditions"][0]["value"] == 1
