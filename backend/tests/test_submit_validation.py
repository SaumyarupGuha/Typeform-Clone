from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.conftest import add_question, create_form, publish, start, submit


def build_form(client: TestClient, *questions: tuple[str, dict[str, Any]]) -> tuple[str, list[dict[str, Any]]]:
    """Create and publish a form with the given (type, changes) questions."""
    form = create_form(client)
    created = [add_question(client, form["id"], type_name, **changes) for type_name, changes in questions]
    return publish(client, form["id"])["slug"], created


def error_for(response: Any, question: dict[str, Any]) -> str:
    assert response.status_code == 422, response.text
    detail = response.json()["detail"]
    assert detail["code"] == "validation_error"
    return detail["errors"][str(question["id"])]


def test_valid_submission_is_stored_and_returns_thank_you(client: TestClient) -> None:
    slug, (name, rating, yes_no, choice) = build_form(
        client,
        ("short_text", {"required": True}),
        ("rating", {}),
        ("yes_no", {}),
        ("multiple_choice", {}),
    )
    token = start(client, slug)
    response = submit(
        client,
        slug,
        token,
        [
            {"question_id": name["id"], "value": "Ada"},
            {"question_id": rating["id"], "value": 4},
            {"question_id": yes_no["id"], "value": False},
            {"question_id": choice["id"], "value": [choice["options"][1]["id"]]},
        ],
    )
    assert response.status_code == 201
    assert "title" in response.json()["thank_you_screen"]

    form_id = client.get("/api/forms").json()[0]["id"]
    row = client.get(f"/api/forms/{form_id}/responses").json()["items"][0]["answers"]
    assert row[str(name["id"])] == "Ada"
    assert row[str(rating["id"])] == 4
    assert row[str(yes_no["id"])] is False  # "No" is a real answer, not an empty one
    assert row[str(choice["id"])] == ["Choice 2"]


def test_required_question_must_be_answered(client: TestClient) -> None:
    slug, (name,) = build_form(client, ("short_text", {"required": True}))
    response = submit(client, slug, start(client, slug), [])
    assert error_for(response, name) == "This question is required"


def test_whitespace_only_text_counts_as_empty(client: TestClient) -> None:
    slug, (name,) = build_form(client, ("short_text", {"required": True}))
    response = submit(client, slug, start(client, slug), [{"question_id": name["id"], "value": "   "}])
    assert error_for(response, name) == "This question is required"


def test_optional_question_may_be_skipped(client: TestClient) -> None:
    slug, _ = build_form(client, ("short_text", {}))
    assert submit(client, slug, start(client, slug), []).status_code == 201


@pytest.mark.parametrize("bad_email", ["not-an-email", "a@", "@b.com", "two words@x.com", 42])
def test_invalid_email_is_rejected(client: TestClient, bad_email: Any) -> None:
    slug, (email,) = build_form(client, ("email", {}))
    response = submit(client, slug, start(client, slug), [{"question_id": email["id"], "value": bad_email}])
    assert error_for(response, email) == "Please enter a valid email"


def test_valid_email_is_accepted(client: TestClient) -> None:
    slug, (email,) = build_form(client, ("email", {}))
    response = submit(client, slug, start(client, slug), [{"question_id": email["id"], "value": "ada@example.com"}])
    assert response.status_code == 201


def test_number_must_be_numeric_and_inside_range(client: TestClient) -> None:
    slug, (number,) = build_form(client, ("number", {"properties": {"min": 1, "max": 10}}))

    too_big = submit(client, slug, start(client, slug), [{"question_id": number["id"], "value": 11}])
    assert error_for(too_big, number) == "Please enter a number between 1 and 10"

    not_a_number = submit(client, slug, start(client, slug), [{"question_id": number["id"], "value": "ten"}])
    assert error_for(not_a_number, number) == "Please enter a number"

    boolean = submit(client, slug, start(client, slug), [{"question_id": number["id"], "value": True}])
    assert error_for(boolean, number) == "Please enter a number"

    ok = submit(client, slug, start(client, slug), [{"question_id": number["id"], "value": 7.5}])
    assert ok.status_code == 201


@pytest.mark.parametrize("bad_rating", [0, 6, 2.5, "3", True])
def test_rating_must_be_an_integer_within_steps(client: TestClient, bad_rating: Any) -> None:
    slug, (rating,) = build_form(client, ("rating", {"properties": {"steps": 5}}))
    response = submit(client, slug, start(client, slug), [{"question_id": rating["id"], "value": bad_rating}])
    assert error_for(response, rating) == "Please choose a rating from 1 to 5"


def test_yes_no_must_be_boolean(client: TestClient) -> None:
    slug, (yes_no,) = build_form(client, ("yes_no", {}))
    response = submit(client, slug, start(client, slug), [{"question_id": yes_no["id"], "value": "yes"}])
    assert error_for(response, yes_no) == "Please choose Yes or No"


def test_choice_options_must_belong_to_the_question(client: TestClient) -> None:
    slug, (first, second) = build_form(client, ("multiple_choice", {}), ("multiple_choice", {}))
    foreign_option = second["options"][0]["id"]
    response = submit(client, slug, start(client, slug), [{"question_id": first["id"], "value": [foreign_option]}])
    assert error_for(response, first) == "Please choose from the options"


def test_single_select_rejects_multiple_options(client: TestClient) -> None:
    slug, (choice,) = build_form(client, ("multiple_choice", {}))
    ids = [option["id"] for option in choice["options"]]
    response = submit(client, slug, start(client, slug), [{"question_id": choice["id"], "value": ids}])
    assert error_for(response, choice) == "Please choose only one option"


def test_multi_select_accepts_several_options(client: TestClient) -> None:
    slug, (choice,) = build_form(client, ("multiple_choice", {"properties": {"allow_multiple": True}}))
    ids = [option["id"] for option in choice["options"]]
    assert submit(client, slug, start(client, slug), [{"question_id": choice["id"], "value": ids}]).status_code == 201


def test_dropdown_needs_exactly_one_valid_option_id(client: TestClient) -> None:
    slug, (dropdown,) = build_form(client, ("dropdown", {}))
    as_list = submit(client, slug, start(client, slug), [{"question_id": dropdown["id"], "value": [dropdown["options"][0]["id"]]}])
    assert error_for(as_list, dropdown) == "Please choose one of the options"

    ok = submit(client, slug, start(client, slug), [{"question_id": dropdown["id"], "value": dropdown["options"][0]["id"]}])
    assert ok.status_code == 201


def test_text_longer_than_max_length_is_rejected(client: TestClient) -> None:
    slug, (text_question,) = build_form(client, ("short_text", {"properties": {"max_length": 5}}))
    response = submit(client, slug, start(client, slug), [{"question_id": text_question["id"], "value": "toolong"}])
    assert error_for(response, text_question) == "Please keep this under 5 characters"


def test_all_errors_are_reported_together_and_nothing_is_saved(client: TestClient) -> None:
    slug, (name, email) = build_form(client, ("short_text", {"required": True}), ("email", {}))
    token = start(client, slug)
    response = submit(client, slug, token, [{"question_id": email["id"], "value": "bad"}])

    errors = response.json()["detail"]["errors"]
    assert set(errors) == {str(name["id"]), str(email["id"])}

    form_id = client.get("/api/forms").json()[0]["id"]
    assert client.get(f"/api/forms/{form_id}/responses").json()["total"] == 0
    # The same token can still be used after fixing the answers.
    retry = submit(
        client, slug, token,
        [{"question_id": name["id"], "value": "Ada"}, {"question_id": email["id"], "value": "ada@example.com"}],
    )
    assert retry.status_code == 201


def test_unknown_question_id_is_rejected(client: TestClient) -> None:
    slug, _ = build_form(client, ("short_text", {}))
    response = submit(client, slug, start(client, slug), [{"question_id": 99999, "value": "x"}])
    assert response.status_code == 422
    assert "99999" in response.json()["detail"]["errors"]


def test_a_response_cannot_be_submitted_twice(client: TestClient) -> None:
    slug, (name,) = build_form(client, ("short_text", {}))
    token = start(client, slug)
    answers = [{"question_id": name["id"], "value": "Ada"}]
    assert submit(client, slug, token, answers).status_code == 201
    assert submit(client, slug, token, answers).status_code == 409


def test_unknown_token_is_404(client: TestClient) -> None:
    slug, _ = build_form(client, ("short_text", {}))
    assert submit(client, slug, "nope", []).status_code == 404


def test_token_from_another_form_is_rejected(client: TestClient) -> None:
    slug_a, _ = build_form(client, ("short_text", {}))
    slug_b, _ = build_form(client, ("short_text", {}))
    assert submit(client, slug_b, start(client, slug_a), []).status_code == 404


def test_draft_form_cannot_be_started_or_submitted(client: TestClient) -> None:
    form = create_form(client)
    add_question(client, form["id"], "short_text")
    assert client.post(f"/api/public/forms/{form['slug']}/responses", json={}).status_code == 404
