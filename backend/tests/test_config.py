from pathlib import Path

import pytest

from app.core.config import load_settings
from app.core.database import create_db_engine


def test_frontend_origins_are_parsed_from_a_comma_separated_list(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FRONTEND_ORIGIN", "https://app.example.com/, http://localhost:3000")
    settings = load_settings()
    assert settings.frontend_origins == ("https://app.example.com", "http://localhost:3000")
    assert settings.frontend_origin == "https://app.example.com"  # first one builds public links


def test_database_folder_is_created_for_a_fresh_volume(tmp_path: Path) -> None:
    database = tmp_path / "data" / "nested" / "typeform.db"
    engine = create_db_engine(f"sqlite:///{database}")
    engine.connect().close()
    assert database.parent.is_dir()
    engine.dispose()
