from collections.abc import Iterator
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401
from app.core.config import settings
from app.core.database import Base, create_db_engine, get_db
from app.main import app
from app.models.user import User
from app.services import file_service


@pytest.fixture(autouse=True)
def upload_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Every test uploads into its own temporary folder, never into the project."""
    folder = tmp_path / "uploads"
    monkeypatch.setattr(file_service, "settings", replace(settings, upload_dir=str(folder)))
    return folder


@pytest.fixture()
def db_session() -> Iterator[Session]:
    # StaticPool keeps one in-memory database alive for the whole test.
    engine = create_db_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with factory() as session:
        session.add(User(email=settings.default_user_email, name="Test Creator"))
        session.commit()
        yield session
    engine.dispose()


@pytest.fixture()
def client(db_session: Session) -> Iterator[TestClient]:
    def override_get_db() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


# ---------- helpers shared by the test modules ----------


def create_form(client: TestClient, title: str = "Test form") -> dict[str, Any]:
    response = client.post("/api/forms", json={"title": title})
    assert response.status_code == 201
    return response.json()


def add_question(client: TestClient, form_id: int, type_name: str, **changes: Any) -> dict[str, Any]:
    created = client.post(f"/api/forms/{form_id}/questions", json={"type": type_name})
    assert created.status_code == 201
    question = created.json()
    if changes:
        updated = client.patch(f"/api/questions/{question['id']}", json=changes)
        assert updated.status_code == 200, updated.text
        question = updated.json()
    return question


def publish(client: TestClient, form_id: int) -> dict[str, Any]:
    response = client.post(f"/api/forms/{form_id}/publish")
    assert response.status_code == 200, response.text
    return response.json()


def start(client: TestClient, slug: str) -> str:
    response = client.post(f"/api/public/forms/{slug}/responses", json={})
    assert response.status_code == 201
    return response.json()["token"]


def submit(client: TestClient, slug: str, token: str, answers: list[dict[str, Any]]) -> Any:
    return client.post(f"/api/public/forms/{slug}/responses/{token}/submit", json={"answers": answers})
