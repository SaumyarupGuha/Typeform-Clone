from pathlib import Path
from typing import Any
from urllib.parse import quote

from fastapi.testclient import TestClient

from tests.conftest import add_question, create_form, publish, start, submit

PDF = b"%PDF-1.4 pretend this is a document"


def upload(client: TestClient, slug: str, token: str, question: dict[str, Any], name: str = "cv.pdf", data: bytes = PDF, content_type: str = "application/pdf") -> Any:
    return client.put(
        f"/api/public/forms/{slug}/responses/{token}/files/{question['id']}",
        content=data,
        headers={"X-File-Name": quote(name), "Content-Type": content_type},
    )


def file_form(client: TestClient, **properties: Any) -> tuple[dict[str, Any], str, dict[str, Any]]:
    form = create_form(client)
    question = add_question(client, form["id"], "file_upload", title="Your CV", **({"properties": properties} if properties else {}))
    return form, publish(client, form["id"])["slug"], question


def stored_files(folder: Path) -> list[Path]:
    return sorted(folder.glob("*")) if folder.exists() else []


def test_upload_submit_and_owner_download(client: TestClient, upload_dir: Path) -> None:
    form, slug, question = file_form(client)
    token = start(client, slug)

    response = upload(client, slug, token, question)
    assert response.status_code == 201, response.text
    uploaded = response.json()
    assert (uploaded["name"], uploaded["size"]) == ("cv.pdf", len(PDF))
    assert len(stored_files(upload_dir)) == 1

    done = submit(client, slug, token, [{"question_id": question["id"], "value": uploaded}])
    assert done.status_code == 201, done.text

    row = client.get(f"/api/forms/{form['id']}/responses").json()["items"][0]
    answer = row["answers"][str(question["id"])]
    assert answer["name"] == "cv.pdf" and answer["file_id"] == uploaded["file_id"]

    download = client.get(f"/api/forms/{form['id']}/files/{uploaded['file_id']}")
    assert download.status_code == 200
    assert download.content == PDF
    assert "attachment" in download.headers["content-disposition"]
    assert download.headers["content-type"] == "application/octet-stream"
    assert download.headers["x-content-type-options"] == "nosniff"


def test_required_file_question_must_be_answered(client: TestClient) -> None:
    form, slug, question = file_form(client)
    client.patch(f"/api/questions/{question['id']}", json={"required": True})
    response = submit(client, slug, start(client, slug), [])
    assert response.status_code == 422
    assert response.json()["detail"]["errors"][str(question["id"])] == "This question is required"


def test_an_optional_file_question_can_be_skipped(client: TestClient) -> None:
    form, slug, question = file_form(client)
    assert submit(client, slug, start(client, slug), []).status_code == 201


def test_a_file_from_another_response_cannot_be_claimed(client: TestClient) -> None:
    form, slug, question = file_form(client)
    mine = start(client, slug)
    theirs = start(client, slug)
    foreign = upload(client, slug, theirs, question).json()

    response = submit(client, slug, mine, [{"question_id": question["id"], "value": foreign}])
    assert response.status_code == 422
    assert response.json()["detail"]["errors"][str(question["id"])] == "Please upload the file again"


def test_a_file_cannot_be_used_for_a_different_question(client: TestClient) -> None:
    form = create_form(client)
    first = add_question(client, form["id"], "file_upload", title="First")
    second = add_question(client, form["id"], "file_upload", title="Second")
    slug = publish(client, form["id"])["slug"]
    token = start(client, slug)
    uploaded = upload(client, slug, token, first).json()
    response = submit(client, slug, token, [{"question_id": second["id"], "value": uploaded}])
    assert response.status_code == 422


def test_uploading_again_replaces_the_previous_file(client: TestClient, upload_dir: Path) -> None:
    form, slug, question = file_form(client)
    token = start(client, slug)
    first = upload(client, slug, token, question, name="old.pdf").json()
    second = upload(client, slug, token, question, name="new.pdf", data=PDF + b"!").json()

    assert len(stored_files(upload_dir)) == 1  # the old bytes were removed, not just hidden
    assert first["name"] == "old.pdf" and second["name"] == "new.pdf"
    done = submit(client, slug, token, [{"question_id": question["id"], "value": second}])
    assert done.status_code == 201
    assert client.get(f"/api/forms/{form['id']}/responses").json()["items"][0]["answers"][str(question["id"])]["name"] == "new.pdf"


# ---------- what is refused ----------


def test_file_larger_than_the_limit_is_refused(client: TestClient, upload_dir: Path) -> None:
    form, slug, question = file_form(client, max_size_mb=1, allowed_types="any")
    token = start(client, slug)
    response = upload(client, slug, token, question, name="big.bin", data=b"x" * (1024 * 1024 + 1), content_type="application/octet-stream")
    assert response.status_code == 413
    assert response.json()["detail"]["code"] == "file_too_large"
    assert stored_files(upload_dir) == []


def test_empty_file_is_refused(client: TestClient) -> None:
    form, slug, question = file_form(client)
    assert upload(client, slug, start(client, slug), question, data=b"").status_code == 422


def test_executables_are_always_refused(client: TestClient, upload_dir: Path) -> None:
    form, slug, question = file_form(client)
    response = upload(client, slug, start(client, slug), question, name="setup.exe", data=b"MZ", content_type="application/x-msdownload")
    assert response.status_code == 422
    assert stored_files(upload_dir) == []


def test_allowed_types_setting_is_enforced(client: TestClient) -> None:
    form, slug, question = file_form(client, max_size_mb=5, allowed_types="images")
    token = start(client, slug)
    assert upload(client, slug, token, question, name="notes.pdf").status_code == 422
    assert upload(client, slug, token, question, name="photo.PNG", data=b"\x89PNG", content_type="image/png").status_code == 201


def test_file_names_cannot_escape_the_upload_folder(client: TestClient, upload_dir: Path) -> None:
    form, slug, question = file_form(client)
    response = upload(client, slug, start(client, slug), question, name="../../etc/passwd.pdf")
    assert response.status_code == 201
    assert response.json()["name"] == "passwd.pdf"
    (stored,) = stored_files(upload_dir)
    assert stored.parent == upload_dir  # random name inside the folder, whatever the client sent


def test_uploads_only_go_to_file_questions_of_open_responses(client: TestClient) -> None:
    form = create_form(client)
    text = add_question(client, form["id"], "short_text")
    file_q = add_question(client, form["id"], "file_upload")
    slug = publish(client, form["id"])["slug"]
    token = start(client, slug)

    assert upload(client, slug, token, text).status_code == 404  # not a file question
    assert upload(client, slug, "bad-token", file_q).status_code == 404
    uploaded = upload(client, slug, token, file_q).json()
    submit(client, slug, token, [{"question_id": file_q["id"], "value": uploaded}])
    assert upload(client, slug, token, file_q).status_code == 409  # already submitted

    client.post(f"/api/forms/{form['id']}/unpublish")
    assert upload(client, slug, token, file_q).status_code == 404  # the form is no longer published


def test_the_file_settings_are_validated(client: TestClient) -> None:
    form = create_form(client)
    question = add_question(client, form["id"], "file_upload")
    assert client.patch(f"/api/questions/{question['id']}", json={"properties": {"max_size_mb": 100}}).status_code == 422
    assert client.patch(f"/api/questions/{question['id']}", json={"properties": {"allowed_types": "everything"}}).status_code == 422
    assert client.patch(f"/api/questions/{question['id']}", json={"properties": {"max_size_mb": 5, "allowed_types": "documents"}}).status_code == 200


# ---------- progress, results and cleanup ----------


def test_a_file_survives_in_a_partial_response(client: TestClient) -> None:
    form, slug, question = file_form(client)
    token = start(client, slug)
    uploaded = upload(client, slug, token, question).json()
    client.put(f"/api/public/forms/{slug}/responses/{token}/progress", json={"answers": [{"question_id": question["id"], "value": uploaded}]})

    row = client.get(f"/api/forms/{form['id']}/responses?status=partial").json()["items"][0]
    assert row["answers"][str(question["id"])]["name"] == "cv.pdf"


def test_summary_and_csv_describe_files(client: TestClient) -> None:
    form, slug, question = file_form(client)
    for name in ("a.pdf", "b.pdf"):
        token = start(client, slug)
        uploaded = upload(client, slug, token, question, name=name).json()
        submit(client, slug, token, [{"question_id": question["id"], "value": uploaded}])

    stats = client.get(f"/api/forms/{form['id']}/summary").json()["questions"][0]
    assert stats["answered"] == 2
    assert stats["stats"]["total_bytes"] == 2 * len(PDF)
    assert stats["stats"]["latest"][0] in ("a.pdf", "b.pdf")

    csv = client.get(f"/api/forms/{form['id']}/responses/export.csv").text
    assert "a.pdf" in csv and "b.pdf" in csv


def test_deleting_a_response_removes_its_files(client: TestClient, upload_dir: Path) -> None:
    form, slug, question = file_form(client)
    token = start(client, slug)
    uploaded = upload(client, slug, token, question).json()
    submit(client, slug, token, [{"question_id": question["id"], "value": uploaded}])
    response_id = client.get(f"/api/forms/{form['id']}/responses").json()["items"][0]["id"]

    assert len(stored_files(upload_dir)) == 1
    client.delete(f"/api/forms/{form['id']}/responses/{response_id}")
    assert stored_files(upload_dir) == []
    assert client.get(f"/api/forms/{form['id']}/files/{uploaded['file_id']}").status_code == 404


def test_deleting_a_form_removes_its_files(client: TestClient, upload_dir: Path) -> None:
    form, slug, question = file_form(client)
    token = start(client, slug)
    upload(client, slug, token, question)  # uploaded but never submitted
    assert len(stored_files(upload_dir)) == 1
    assert client.delete(f"/api/forms/{form['id']}").status_code == 204
    assert stored_files(upload_dir) == []


def test_a_file_can_only_be_downloaded_through_its_own_form(client: TestClient) -> None:
    form, slug, question = file_form(client)
    other = create_form(client, "Other")
    token = start(client, slug)
    uploaded = upload(client, slug, token, question).json()
    assert client.get(f"/api/forms/{other['id']}/files/{uploaded['file_id']}").status_code == 404


def test_deleting_a_question_with_an_unsubmitted_upload_is_a_soft_delete(client: TestClient) -> None:
    form, slug, question = file_form(client)
    upload(client, slug, start(client, slug), question)
    assert client.delete(f"/api/questions/{question['id']}").status_code == 204  # no foreign-key error
    assert client.get(f"/api/forms/{form['id']}").json()["questions"] == []


def test_logic_can_branch_on_whether_a_file_was_uploaded(client: TestClient) -> None:
    form = create_form(client)
    file_q = add_question(client, form["id"], "file_upload", title="CV")
    later = add_question(client, form["id"], "short_text", title="Later")
    ok = client.patch(f"/api/questions/{file_q['id']}", json={"logic": {"rules": [
        {"match": "all", "conditions": [{"question_id": file_q["id"], "operator": "is_not_answered", "value": None}], "jump_to": later["id"]}
    ], "otherwise": None}})
    assert ok.status_code == 200
    bad = client.patch(f"/api/questions/{file_q['id']}", json={"logic": {"rules": [
        {"match": "all", "conditions": [{"question_id": file_q["id"], "operator": "is", "value": "x"}], "jump_to": later["id"]}
    ], "otherwise": None}})
    assert bad.status_code == 422
