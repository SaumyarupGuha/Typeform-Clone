from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from tests.conftest import add_question, create_form, publish, start, submit


def test_foreign_keys_are_enabled(db_session: Session) -> None:
    assert db_session.execute(text("PRAGMA foreign_keys")).scalar() == 1


def test_create_get_rename_form(client: TestClient) -> None:
    form = create_form(client, "Survey")
    assert form["status"] == "draft"
    assert len(form["slug"]) == 8

    renamed = client.patch(f"/api/forms/{form['id']}", json={"title": "Renamed"})
    assert renamed.status_code == 200
    assert client.get(f"/api/forms/{form['id']}").json()["title"] == "Renamed"


def test_blank_title_is_rejected_in_standard_error_shape(client: TestClient) -> None:
    form = create_form(client)
    response = client.patch(f"/api/forms/{form['id']}", json={"title": ""})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation_error"
    assert "title" in response.json()["detail"]["errors"]


def test_unknown_form_is_404(client: TestClient) -> None:
    response = client.get("/api/forms/999")
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "not_found"


def test_list_forms_counts_only_completed_responses(client: TestClient) -> None:
    form = create_form(client, "Counted")
    question = add_question(client, form["id"], "short_text")
    published = publish(client, form["id"])
    slug = published["slug"]

    submit(client, slug, start(client, slug), [{"question_id": question["id"], "value": "hi"}])
    start(client, slug)  # started but never finished

    listing = client.get("/api/forms").json()
    assert listing[0]["response_count"] == 1


def test_list_forms_search_and_status_filter(client: TestClient) -> None:
    create_form(client, "Alpha")
    beta = create_form(client, "Beta")
    add_question(client, beta["id"], "email")
    publish(client, beta["id"])

    assert [f["title"] for f in client.get("/api/forms?search=alp").json()] == ["Alpha"]
    assert [f["title"] for f in client.get("/api/forms?status=published").json()] == ["Beta"]


def test_duplicate_copies_questions_and_options_but_not_responses(client: TestClient) -> None:
    form = create_form(client, "Original")
    choice = add_question(client, form["id"], "multiple_choice", title="Pick one")
    slug = publish(client, form["id"])["slug"]
    submit(client, slug, start(client, slug), [{"question_id": choice["id"], "value": [choice["options"][0]["id"]]}])

    copy = client.post(f"/api/forms/{form['id']}/duplicate").json()
    assert copy["title"] == "Copy of Original"
    assert copy["status"] == "draft"
    assert copy["slug"] != form["slug"]
    assert [o["label"] for o in copy["questions"][0]["options"]] == ["Choice 1", "Choice 2"]
    assert copy["questions"][0]["options"][0]["id"] != choice["options"][0]["id"]
    copy_summary = next(f for f in client.get("/api/forms").json() if f["id"] == copy["id"])
    assert copy_summary["response_count"] == 0


def test_delete_form_cascades_to_questions_and_responses(client: TestClient, db_session: Session) -> None:
    form = create_form(client)
    question = add_question(client, form["id"], "short_text")
    slug = publish(client, form["id"])["slug"]
    submit(client, slug, start(client, slug), [{"question_id": question["id"], "value": "x"}])

    assert client.delete(f"/api/forms/{form['id']}").status_code == 204
    assert client.get(f"/api/forms/{form['id']}").status_code == 404
    for table in ("questions", "responses", "answers"):
        assert db_session.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar() == 0


def test_publish_requires_a_question(client: TestClient) -> None:
    form = create_form(client)
    response = client.post(f"/api/forms/{form['id']}/publish")
    assert response.status_code == 422


def test_publish_then_unpublish_controls_public_access(client: TestClient) -> None:
    form = create_form(client)
    add_question(client, form["id"], "short_text", title="Name")
    published = publish(client, form["id"])
    assert published["status"] == "published"
    assert published["public_url"].endswith(f"/to/{published['slug']}")

    public = client.get(f"/api/public/forms/{published['slug']}")
    assert public.status_code == 200
    assert "status" not in public.json()

    client.post(f"/api/forms/{form['id']}/unpublish")
    assert client.get(f"/api/public/forms/{published['slug']}").status_code == 404


def test_add_question_gets_defaults_and_starter_options(client: TestClient) -> None:
    form = create_form(client)
    rating = add_question(client, form["id"], "rating")
    choice = add_question(client, form["id"], "dropdown")
    assert rating["properties"] == {"steps": 5, "shape": "star"}
    assert rating["options"] == []
    assert len(choice["options"]) == 2


def test_add_question_at_position_shifts_others(client: TestClient) -> None:
    form = create_form(client)
    first = add_question(client, form["id"], "short_text")
    second = add_question(client, form["id"], "email")
    inserted = client.post(f"/api/forms/{form['id']}/questions", json={"type": "number", "position": 1}).json()

    order = [q["id"] for q in client.get(f"/api/forms/{form['id']}").json()["questions"]]
    assert order == [first["id"], inserted["id"], second["id"]]


def test_options_diff_keeps_ids_renames_adds_and_removes(client: TestClient) -> None:
    form = create_form(client)
    question = add_question(client, form["id"], "multiple_choice")
    keep, drop = question["options"]

    updated = client.patch(
        f"/api/questions/{question['id']}",
        json={"options": [{"label": "New first"}, {"id": keep["id"], "label": "Renamed"}]},
    ).json()

    labels = [o["label"] for o in updated["options"]]
    assert labels == ["New first", "Renamed"]
    assert updated["options"][1]["id"] == keep["id"]
    assert drop["id"] not in [o["id"] for o in updated["options"]]


def test_cannot_remove_an_option_that_has_responses(client: TestClient) -> None:
    form = create_form(client)
    question = add_question(client, form["id"], "multiple_choice")
    chosen, other = question["options"]
    slug = publish(client, form["id"])["slug"]
    submit(client, slug, start(client, slug), [{"question_id": question["id"], "value": [chosen["id"]]}])

    response = client.patch(f"/api/questions/{question['id']}", json={"options": [{"id": other["id"], "label": "B"}]})
    assert response.status_code == 409


def test_properties_are_validated(client: TestClient) -> None:
    form = create_form(client)
    rating = add_question(client, form["id"], "rating")
    response = client.patch(f"/api/questions/{rating['id']}", json={"properties": {"steps": 20}})
    assert response.status_code == 422


def test_reorder_rewrites_positions_and_validates_ids(client: TestClient) -> None:
    form = create_form(client)
    a = add_question(client, form["id"], "short_text")
    b = add_question(client, form["id"], "email")
    c = add_question(client, form["id"], "number")

    reordered = client.put(f"/api/forms/{form['id']}/questions/order", json={"question_ids": [c["id"], a["id"], b["id"]]})
    assert [q["id"] for q in reordered.json()] == [c["id"], a["id"], b["id"]]
    assert [q["position"] for q in reordered.json()] == [0, 1, 2]

    bad = client.put(f"/api/forms/{form['id']}/questions/order", json={"question_ids": [a["id"], b["id"]]})
    assert bad.status_code == 422


def test_delete_unanswered_question_is_hard_delete(client: TestClient, db_session: Session) -> None:
    form = create_form(client)
    question = add_question(client, form["id"], "short_text")
    assert client.delete(f"/api/questions/{question['id']}").status_code == 204
    assert db_session.execute(text("SELECT COUNT(*) FROM questions")).scalar() == 0


def test_delete_answered_question_is_soft_and_stays_in_results(client: TestClient, db_session: Session) -> None:
    form = create_form(client)
    keep = add_question(client, form["id"], "short_text", title="Keep")
    gone = add_question(client, form["id"], "short_text", title="Gone")
    slug = publish(client, form["id"])["slug"]
    submit(
        client,
        slug,
        start(client, slug),
        [{"question_id": keep["id"], "value": "a"}, {"question_id": gone["id"], "value": "b"}],
    )

    assert client.delete(f"/api/questions/{gone['id']}").status_code == 204

    assert db_session.execute(text("SELECT deleted_at IS NOT NULL FROM questions WHERE id = :id"), {"id": gone["id"]}).scalar() == 1
    assert [q["id"] for q in client.get(f"/api/forms/{form['id']}").json()["questions"]] == [keep["id"]]
    assert [q["id"] for q in client.get(f"/api/public/forms/{slug}").json()["questions"]] == [keep["id"]]

    results = client.get(f"/api/forms/{form['id']}/responses").json()
    assert [(q["title"], q["deleted"]) for q in results["questions"]] == [("Keep", False), ("Gone", True)]
    assert results["items"][0]["answers"][str(gone["id"])] == "b"


def test_duplicate_question_inserts_copy_below(client: TestClient) -> None:
    form = create_form(client)
    first = add_question(client, form["id"], "short_text", title="First")
    last = add_question(client, form["id"], "email", title="Last")
    copy = client.post(f"/api/questions/{first['id']}/duplicate").json()

    order = [q["id"] for q in client.get(f"/api/forms/{form['id']}").json()["questions"]]
    assert order == [first["id"], copy["id"], last["id"]]
    assert copy["title"] == "First"
