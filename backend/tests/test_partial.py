from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import add_question, create_form, publish, start, submit


def progress(client: TestClient, slug: str, token: str, answers: list[dict[str, Any]]) -> Any:
    return client.put(f"/api/public/forms/{slug}/responses/{token}/progress", json={"answers": answers})


def answer(question: dict[str, Any], value: Any) -> dict[str, Any]:
    return {"question_id": question["id"], "value": value}


def four_question_form(client: TestClient) -> tuple[dict[str, Any], str, list[dict[str, Any]]]:
    form = create_form(client)
    questions = [
        add_question(client, form["id"], "short_text", title="Name", required=True),
        add_question(client, form["id"], "email", title="Email", required=True),
        add_question(client, form["id"], "rating", title="Rating"),
        add_question(client, form["id"], "short_text", title="Comment"),
    ]
    return form, publish(client, form["id"])["slug"], questions


def rows(client: TestClient, form_id: int, status: str) -> dict[str, Any]:
    return client.get(f"/api/forms/{form_id}/responses?status={status}").json()


def test_progress_is_saved_and_listed_as_partial(client: TestClient) -> None:
    form, slug, (name, email, *_) = four_question_form(client)
    token = start(client, slug)
    assert progress(client, slug, token, [answer(name, "Ada")]).status_code == 204

    partial = rows(client, form["id"], "partial")
    assert partial["total"] == 1
    row = partial["items"][0]
    assert row["status"] == "partial"
    assert row["submitted_at"] is None
    assert row["answers"] == {str(name["id"]): "Ada"}
    assert row["last_question_id"] == name["id"]

    # The default list is completed responses only, as before.
    default = client.get(f"/api/forms/{form['id']}/responses").json()
    assert default["total"] == 0
    assert (default["completed_count"], default["partial_count"]) == (0, 1)


def test_progress_does_not_complain_about_required_or_half_typed_answers(client: TestClient) -> None:
    form, slug, (name, email, *_) = four_question_form(client)
    token = start(client, slug)
    # Name is empty (required) and the email is not valid yet: nothing is rejected, and only valid answers are kept.
    response = progress(client, slug, token, [answer(name, ""), answer(email, "ada@")])
    assert response.status_code == 204
    assert rows(client, form["id"], "partial")["items"][0]["answers"] == {}


def test_each_progress_call_replaces_the_previous_one(client: TestClient) -> None:
    form, slug, (name, email, *_) = four_question_form(client)
    token = start(client, slug)
    progress(client, slug, token, [answer(name, "Ada"), answer(email, "ada@example.com")])
    progress(client, slug, token, [answer(name, "Grace")])  # went back, cleared the email

    stored = rows(client, form["id"], "partial")["items"][0]["answers"]
    assert stored == {str(name["id"]): "Grace"}


def test_progress_ignores_answers_to_questions_skipped_by_logic(client: TestClient) -> None:
    form, slug, (name, email, rating, comment) = four_question_form(client)
    client.patch(f"/api/questions/{name['id']}", json={"logic": {"rules": [
        {"match": "all", "conditions": [{"question_id": name["id"], "operator": "is", "value": "skip"}], "jump_to": comment["id"]}
    ], "otherwise": None}})
    token = start(client, slug)
    progress(client, slug, token, [answer(name, "skip"), answer(email, "stale@example.com"), answer(comment, "hi")])
    stored = rows(client, form["id"], "partial")["items"][0]["answers"]
    assert str(email["id"]) not in stored
    assert stored[str(comment["id"])] == "hi"


def test_submit_replaces_partial_answers_and_completes(client: TestClient) -> None:
    form, slug, (name, email, rating, comment) = four_question_form(client)
    token = start(client, slug)
    progress(client, slug, token, [answer(name, "Ada"), answer(email, "ada@example.com"), answer(rating, 4)])

    done = submit(client, slug, token, [answer(name, "Ada L"), answer(email, "ada@example.com")])
    assert done.status_code == 201

    completed = rows(client, form["id"], "completed")
    assert completed["total"] == 1
    assert completed["items"][0]["status"] == "completed"
    # The rating given as progress but left out of the final submit is gone: submit is the truth.
    assert completed["items"][0]["answers"] == {str(name["id"]): "Ada L", str(email["id"]): "ada@example.com"}
    assert rows(client, form["id"], "partial")["total"] == 0


def test_progress_after_submit_is_refused(client: TestClient) -> None:
    form, slug, (name, email, *_) = four_question_form(client)
    token = start(client, slug)
    submit(client, slug, token, [answer(name, "Ada"), answer(email, "ada@example.com")])
    assert progress(client, slug, token, [answer(name, "Changed")]).status_code == 409


def test_progress_needs_a_published_form_and_a_real_token(client: TestClient) -> None:
    form, slug, (name, *_) = four_question_form(client)
    assert progress(client, slug, "nope", [answer(name, "x")]).status_code == 404
    token = start(client, slug)
    client.post(f"/api/forms/{form['id']}/unpublish")
    assert progress(client, slug, token, [answer(name, "x")]).status_code == 404


def test_partial_answers_do_not_change_summary_statistics_or_workspace_counts(client: TestClient) -> None:
    form, slug, (name, email, rating, comment) = four_question_form(client)
    token = start(client, slug)
    progress(client, slug, token, [answer(name, "Ada"), answer(email, "ada@example.com"), answer(rating, 5)])

    summary = client.get(f"/api/forms/{form['id']}/summary").json()
    by_id = {q["question_id"]: q for q in summary["questions"]}
    assert by_id[rating["id"]]["answered"] == 0  # statistics describe completed responses only
    assert client.get("/api/forms").json()[0]["response_count"] == 0


def test_summary_reports_partial_responses_and_where_people_left(client: TestClient) -> None:
    form, slug, (name, email, rating, comment) = four_question_form(client)

    one = start(client, slug)
    progress(client, slug, one, [answer(name, "A")])  # left after the first question
    two = start(client, slug)
    progress(client, slug, two, [answer(name, "B"), answer(email, "b@example.com"), answer(rating, 3)])  # left after rating
    start(client, slug)  # opened the form and never answered
    done = start(client, slug)
    submit(client, slug, done, [answer(name, "C"), answer(email, "c@example.com")])

    summary = client.get(f"/api/forms/{form['id']}/summary").json()
    assert (summary["started"], summary["completed"], summary["partial"]) == (4, 1, 3)
    assert summary["completion_rate"] == 25.0
    assert summary["left_before_first"] == 1

    funnel = {step["question_id"]: step for step in summary["funnel"]}
    assert [funnel[q["id"]]["answered"] for q in (name, email, rating, comment)] == [3, 2, 1, 0]
    assert [funnel[q["id"]]["left_here"] for q in (name, email, rating, comment)] == [1, 0, 1, 0]


def test_partial_response_detail_and_delete(client: TestClient) -> None:
    form, slug, (name, email, *_) = four_question_form(client)
    token = start(client, slug)
    progress(client, slug, token, [answer(name, "Ada")])
    response_id = rows(client, form["id"], "partial")["items"][0]["id"]

    detail = client.get(f"/api/forms/{form['id']}/responses/{response_id}").json()
    assert detail["status"] == "partial"
    assert detail["submitted_at"] is None
    assert detail["last_question_id"] == name["id"]
    assert [a["value"] for a in detail["answers"]][:2] == ["Ada", None]

    assert client.delete(f"/api/forms/{form['id']}/responses/{response_id}").status_code == 204
    assert rows(client, form["id"], "all")["total"] == 0


def test_all_filter_orders_newest_first_across_both_kinds(client: TestClient) -> None:
    form, slug, (name, email, *_) = four_question_form(client)
    first = start(client, slug)
    submit(client, slug, first, [answer(name, "done"), answer(email, "d@example.com")])
    second = start(client, slug)
    progress(client, slug, second, [answer(name, "partial")])

    everything = rows(client, form["id"], "all")
    assert everything["total"] == 2
    assert [item["status"] for item in everything["items"]] == ["partial", "completed"]


def test_csv_can_include_partial_responses(client: TestClient) -> None:
    form, slug, (name, email, *_) = four_question_form(client)
    done = start(client, slug)
    submit(client, slug, done, [answer(name, "Ada"), answer(email, "ada@example.com")])
    token = start(client, slug)
    progress(client, slug, token, [answer(name, "Grace")])

    default = client.get(f"/api/forms/{form['id']}/responses/export.csv").text.strip().splitlines()
    assert default[0].startswith("Submitted at,Name")
    assert len(default) == 2

    everything = client.get(f"/api/forms/{form['id']}/responses/export.csv?status=all").text.strip().splitlines()
    assert everything[0].startswith("Status,Date,Name")
    assert len(everything) == 3
    assert any(line.startswith("Partial,") and "Grace" in line for line in everything)
