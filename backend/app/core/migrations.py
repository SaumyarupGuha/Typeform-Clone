"""Small, explicit schema upgrades for databases created by an earlier version of the app.

`Base.metadata.create_all` creates tables that are missing (such as `files`) but never changes a
table that already exists. The one change so far is a new value allowed by the CHECK constraint on
`questions.type` (`file_upload`). SQLite cannot alter a constraint in place, so the table is rebuilt
the way the SQLite documentation recommends: create the new table, copy, drop the old, rename.
A real migration tool (Alembic) is the production answer; this keeps existing demo data working.
"""

from sqlalchemy import Engine
from sqlalchemy.dialects import sqlite
from sqlalchemy.schema import CreateIndex, CreateTable

from app.models.question import Question

_NEW_TYPE = "file_upload"


def upgrade_schema(engine: Engine) -> None:
    if engine.dialect.name != "sqlite":
        return
    with engine.connect() as connection:
        row = connection.exec_driver_sql("SELECT sql FROM sqlite_master WHERE type='table' AND name='questions'").first()
    if row is None or _NEW_TYPE in (row[0] or ""):
        return  # no table yet (create_all will make it) or already up to date
    _rebuild_questions_table(engine)


def _rebuild_questions_table(engine: Engine) -> None:
    table = Question.__table__
    dialect = sqlite.dialect()
    create_sql = str(CreateTable(table).compile(dialect=dialect)).strip().replace(
        "CREATE TABLE questions", "CREATE TABLE questions_new", 1
    )
    index_sql = [str(CreateIndex(index).compile(dialect=dialect)).strip() for index in table.indexes]
    columns = ", ".join(column.name for column in table.columns)

    # AUTOCOMMIT so PRAGMA foreign_keys (which cannot change inside a transaction) and the
    # explicit BEGIN/COMMIT below behave. With foreign keys off, dropping the old table does
    # not cascade into question_options or answers.
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        try:
            connection.exec_driver_sql("BEGIN")
            connection.exec_driver_sql("DROP TABLE IF EXISTS questions_new")
            connection.exec_driver_sql(create_sql)
            connection.exec_driver_sql(f"INSERT INTO questions_new ({columns}) SELECT {columns} FROM questions")
            connection.exec_driver_sql("DROP TABLE questions")
            connection.exec_driver_sql("ALTER TABLE questions_new RENAME TO questions")
            for statement in index_sql:
                connection.exec_driver_sql(statement)
            connection.exec_driver_sql("COMMIT")
        except Exception:
            connection.exec_driver_sql("ROLLBACK")
            raise
        finally:
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
