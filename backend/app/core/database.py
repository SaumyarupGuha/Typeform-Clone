from collections.abc import Iterator
from pathlib import Path
from typing import Any

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


def _enable_foreign_keys(dbapi_connection: Any, _connection_record: Any) -> None:
    # SQLite ignores foreign keys (and therefore ON DELETE CASCADE) unless this
    # pragma is switched on for every new connection.
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def ensure_sqlite_directory(url: str) -> None:
    """SQLite creates the file but not its folder; a fresh volume (like /data) starts empty."""
    parsed = make_url(url)
    if parsed.get_backend_name() == "sqlite" and parsed.database and parsed.database != ":memory:":
        Path(parsed.database).parent.mkdir(parents=True, exist_ok=True)


def create_db_engine(url: str, **engine_kwargs: Any) -> Engine:
    ensure_sqlite_directory(url)
    engine = create_engine(url, connect_args={"check_same_thread": False}, **engine_kwargs)
    event.listen(engine, "connect", _enable_foreign_keys)
    return engine


engine = create_db_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
