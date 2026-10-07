from pathlib import Path

from sqlalchemy import text

from app.core.database import Base, create_db_engine
from app.core.migrations import upgrade_schema

# The questions table exactly as an earlier version created it: no 'file_upload' in the CHECK.
OLD_SCHEMA = """
CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created_at DATETIME NOT NULL);
CREATE TABLE forms (
  id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'x', slug TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'draft',
  settings JSON NOT NULL DEFAULT '{}', published_at DATETIME, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL
);
CREATE TABLE questions (
  id INTEGER PRIMARY KEY, form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', description TEXT,
  required BOOLEAN NOT NULL DEFAULT 0, properties JSON NOT NULL DEFAULT '{}', deleted_at DATETIME,
  created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
  CONSTRAINT ck_questions_type CHECK (type IN ('short_text','long_text','multiple_choice','dropdown','email','number','yes_no','rating'))
);
CREATE INDEX ix_questions_form_pos ON questions (form_id, position);
CREATE TABLE question_options (
  id INTEGER PRIMARY KEY, question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, label TEXT NOT NULL
);
INSERT INTO users VALUES (1, 'a@b.c', 'A', '2026-01-01');
INSERT INTO forms VALUES (1, 1, 'Old form', 'abc12345', 'published', '{}', NULL, '2026-01-01', '2026-01-01');
INSERT INTO questions VALUES (7, 1, 0, 'short_text', 'Name', NULL, 1, '{"max_length": 50}', NULL, '2026-01-01', '2026-01-01');
INSERT INTO question_options VALUES (3, 7, 0, 'kept');
"""


def old_database(path: Path):  # type: ignore[no-untyped-def]
    engine = create_db_engine(f"sqlite:///{path}")
    with engine.begin() as connection:
        for statement in OLD_SCHEMA.split(";\n"):
            if statement.strip():
                connection.exec_driver_sql(statement)
    return engine


def test_an_older_database_is_upgraded_and_keeps_its_data(tmp_path: Path) -> None:
    engine = old_database(tmp_path / "old.db")

    upgrade_schema(engine)
    Base.metadata.create_all(engine)  # adds the new files table, as the app does on startup

    with engine.begin() as connection:
        # The new question type is now accepted.
        connection.execute(text(
            "INSERT INTO questions (form_id, position, type, title, required, properties, created_at, updated_at) "
            "VALUES (1, 1, 'file_upload', 'CV', 0, '{}', '2026-01-02', '2026-01-02')"
        ))
        # Existing rows and their children survived the rebuild.
        row = connection.execute(text("SELECT title, required, properties FROM questions WHERE id = 7")).one()
        assert (row[0], row[1], row[2]) == ("Name", 1, '{"max_length": 50}')
        assert connection.execute(text("SELECT label FROM question_options WHERE question_id = 7")).scalar() == "kept"
        assert connection.execute(text("PRAGMA foreign_key_check")).fetchall() == []
        indexes = {r[1] for r in connection.execute(text("PRAGMA index_list(questions)"))}
        assert "ix_questions_form_pos" in indexes
    engine.dispose()


def test_upgrading_twice_changes_nothing(tmp_path: Path) -> None:
    engine = old_database(tmp_path / "old.db")
    upgrade_schema(engine)
    upgrade_schema(engine)  # already up to date: a no-op
    with engine.connect() as connection:
        assert connection.execute(text("SELECT COUNT(*) FROM questions")).scalar() == 1
    engine.dispose()


def test_a_new_database_needs_no_upgrade(tmp_path: Path) -> None:
    engine = create_db_engine(f"sqlite:///{tmp_path / 'new.db'}")
    upgrade_schema(engine)  # no questions table yet: nothing to do
    Base.metadata.create_all(engine)
    upgrade_schema(engine)  # created with the current schema: nothing to do
    with engine.connect() as connection:
        sql = connection.execute(text("SELECT sql FROM sqlite_master WHERE name='questions'")).scalar()
    assert "file_upload" in sql
    engine.dispose()
