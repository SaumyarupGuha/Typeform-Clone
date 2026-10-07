from typing import Annotated

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(db: DbSession) -> User:
    """The single seeded creator. This is the one place to swap in real auth later."""
    user = db.scalar(select(User).where(User.email == settings.default_user_email))
    if user is None:
        raise RuntimeError("Default creator is missing; run `python -m app.seed`.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
