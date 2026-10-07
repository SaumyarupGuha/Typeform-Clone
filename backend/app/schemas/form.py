from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.core.config import settings as app_settings
from app.models.form import Form
from app.schemas.common import UtcDatetime
from app.schemas.question import QuestionOut

class Theme(BaseModel):
    primary: str = Field(default="#262627", pattern=r"^#[0-9a-fA-F]{6}$")
    background: str = Field(default="#FAFAFA", pattern=r"^#[0-9a-fA-F]{6}$")
    font: str = Field(default="Inter", max_length=60)


class WelcomeScreen(BaseModel):
    enabled: bool = False
    title: str = Field(default="Welcome", max_length=200)
    button_text: str = Field(default="Start", max_length=40)


class ThankYouScreen(BaseModel):
    title: str = Field(default="Thanks for completing this form!", max_length=200)
    description: str = Field(default="Your response has been recorded.", max_length=1000)


class FormSettings(BaseModel):
    theme: Theme = Field(default_factory=Theme)
    welcome_screen: WelcomeScreen = Field(default_factory=WelcomeScreen)
    thank_you_screen: ThankYouScreen = Field(default_factory=ThankYouScreen)


class FormCreate(BaseModel):
    title: str = Field(default="My new form", min_length=1, max_length=200)


class FormUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    settings: FormSettings | None = None


def public_url_for(slug: str) -> str:
    return f"{app_settings.frontend_origin}/to/{slug}"


class FormSummaryOut(BaseModel):
    """One row of the workspace list."""

    id: int
    title: str
    slug: str
    status: Literal["draft", "published"]
    response_count: int
    updated_at: UtcDatetime
    public_url: str

    @classmethod
    def from_model(cls, form: Form, response_count: int) -> FormSummaryOut:
        return cls(
            id=form.id,
            title=form.title,
            slug=form.slug,
            status=form.status,  # type: ignore[arg-type]
            response_count=response_count,
            updated_at=form.updated_at,
            public_url=public_url_for(form.slug),
        )


class FormOut(BaseModel):
    id: int
    title: str
    slug: str
    status: Literal["draft", "published"]
    settings: FormSettings
    published_at: UtcDatetime | None
    created_at: UtcDatetime
    updated_at: UtcDatetime
    public_url: str
    questions: list[QuestionOut]

    @classmethod
    def from_model(cls, form: Form) -> FormOut:
        return cls(
            id=form.id,
            title=form.title,
            slug=form.slug,
            status=form.status,  # type: ignore[arg-type]
            settings=FormSettings.model_validate(form.settings),
            published_at=form.published_at,
            created_at=form.created_at,
            updated_at=form.updated_at,
            public_url=public_url_for(form.slug),
            questions=[QuestionOut.model_validate(q) for q in form.live_questions],
        )


class PublicFormOut(BaseModel):
    """What a respondent may see: no owner, status or counts."""

    title: str
    slug: str
    settings: FormSettings
    questions: list[QuestionOut]

    @classmethod
    def from_model(cls, form: Form) -> PublicFormOut:
        return cls(
            title=form.title,
            slug=form.slug,
            settings=FormSettings.model_validate(form.settings),
            questions=[QuestionOut.model_validate(q) for q in form.live_questions],
        )
