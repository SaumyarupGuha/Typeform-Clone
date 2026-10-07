from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import seed
from app.core.database import Base
from app.models.question import QUESTION_TYPE_NAMES
from app.question_types import QUESTION_TYPES
from tests.conftest import add_question, create_form, publish, start, submit


def test_registry_matches_database_type_constraint() -> None:
    assert set(QUESTION_TYPES) == set(QUESTION_TYPE_NAMES)


def test_summary_stats_per_type(client: TestClient) -> None:
    form = create_form(client)
    choice = add_question(client, form["id"], "multiple_choice")
    rating = add_question(client, form["id"], "rating")
    yes_no = add_question(client, form["id"], "yes_no")
    number = add_question(client, form["id"], "number")
    text = add_question(client, form["id"], "short_text")
    slug = publish(client, form["id"])["slug"]
    first, second = choice["options"]

    for option, stars, answer, count, words in [(first, 5, True, 10, "one"), (first, 3, True, 20, "two"), (second, 4, False, 30, "three")]:
        submit(
            client, slug, start(client, slug),
            [
                {"question_id": choice["id"], "value": [option["id"]]},
                {"question_id": rating["id"], "value": stars},
                {"question_id": yes_no["id"], "value": answer},
                {"question_id": number["id"], "value": count},
                {"question_id": text["id"], "value": words},
            ],
        )
    start(client, slug)  # one abandoned visit

    summary = client.get(f"/api/forms/{form['id']}/summary").json()
    assert (summary["started"], summary["completed"], summary["completion_rate"]) == (4, 3, 75.0)

    by_id = {q["question_id"]: q for q in summary["questions"]}
    options = by_id[choice["id"]]["stats"]["options"]
    assert [(o["label"], o["count"], o["percent"]) for o in options] == [("Choice 1", 2, 66.7), ("Choice 2", 1, 33.3)]
    assert by_id[rating["id"]]["stats"]["average"] == 4.0
    assert [d["count"] for d in by_id[rating["id"]]["stats"]["distribution"]] == [0, 0, 1, 1, 1]
    assert by_id[yes_no["id"]]["stats"] == {"yes": 2, "no": 1}
    assert by_id[number["id"]]["stats"] == {"min": 10, "max": 30, "average": 20.0}
    assert by_id[text["id"]]["answered"] == 3
    assert by_id[text["id"]]["stats"]["latest"][0] == "three"


def test_response_detail_delete_and_csv(client: TestClient) -> None:
    form = create_form(client)
    name = add_question(client, form["id"], "short_text", title="Name")
    note = add_question(client, form["id"], "long_text", title="Note")
    slug = publish(client, form["id"])["slug"]
    submit(client, slug, start(client, slug), [
        {"question_id": name["id"], "value": "Ada"},
        {"question_id": note["id"], "value": "=HYPERLINK(evil)"},
    ])

    listing = client.get(f"/api/forms/{form['id']}/responses").json()
    response_id = listing["items"][0]["id"]
    detail = client.get(f"/api/forms/{form['id']}/responses/{response_id}").json()
    assert [(a["question"]["title"], a["value"]) for a in detail["answers"]][0] == ("Name", "Ada")

    csv_response = client.get(f"/api/forms/{form['id']}/responses/export.csv")
    assert csv_response.headers["content-type"].startswith("text/csv")
    lines = csv_response.text.strip().splitlines()
    assert lines[0] == "Submitted at,Name,Note"
    assert lines[1].endswith(",Ada,'=HYPERLINK(evil)")  # formula neutralised

    assert client.delete(f"/api/forms/{form['id']}/responses/{response_id}").status_code == 204
    assert client.get(f"/api/forms/{form['id']}/responses/{response_id}").status_code == 404
    assert client.get(f"/api/forms/{form['id']}/responses").json()["total"] == 0


def test_responses_are_paginated_newest_first(client: TestClient) -> None:
    form = create_form(client)
    name = add_question(client, form["id"], "short_text")
    slug = publish(client, form["id"])["slug"]
    for value in ("a", "b", "c"):
        submit(client, slug, start(client, slug), [{"question_id": name["id"], "value": value}])

    page = client.get(f"/api/forms/{form['id']}/responses?page=1&limit=2").json()
    assert page["total"] == 3
    assert [item["answers"][str(name["id"])] for item in page["items"]] == ["c", "b"]


def test_seed_creates_expected_demo_data(db_session: Session, client: TestClient) -> None:
    from sqlalchemy import delete

    from app.models.user import User

    db_session.execute(delete(User))  # drop the fixture's user; seed creates its own
    db_session.commit()
    seed.seed_database(db_session)

    forms = {f["title"]: f for f in client.get("/api/forms").json()}
    assert forms["Customer Satisfaction Survey"]["status"] == "published"
    assert forms["Customer Satisfaction Survey"]["response_count"] == 40
    assert forms["Event Registration"]["response_count"] == 15
    assert forms["Product Research"]["status"] == "draft"

    summary = client.get(f"/api/forms/{forms['Customer Satisfaction Survey']['id']}/summary").json()
    assert summary["started"] == 48
    assert Base.metadata.tables  # sanity: models registered
