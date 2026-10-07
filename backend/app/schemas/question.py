from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, JsonValue, field_validator

from app.schemas.logic import LogicConfig

QuestionTypeName = Literal[
    "short_text", "long_text", "multiple_choice", "dropdown", "email", "number", "yes_no", "rating", "file_upload"
]


class OptionIn(BaseModel):
    id: int | None = None  # present = keep/rename this option, absent = new option
    label: str = Field(max_length=500)


class OptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str


class QuestionCreate(BaseModel):
    type: QuestionTypeName
    position: int | None = Field(default=None, ge=0)


class QuestionUpdate(BaseModel):
    """Every field is optional; only fields present in the request are applied."""

    title: str | None = Field(default=None, max_length=1000)
    description: str | None = Field(default=None, max_length=2000)
    required: bool | None = None
    type: QuestionTypeName | None = None
    properties: dict[str, JsonValue] | None = None
    options: list[OptionIn] | None = None
    logic: LogicConfig | None = None


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    position: int
    type: str
    title: str
    description: str | None
    required: bool
    properties: dict[str, JsonValue]
    options: list[OptionOut]
    deleted: bool = False
    logic: LogicConfig = Field(default_factory=LogicConfig)

    @field_validator("properties")
    @classmethod
    def _hide_logic(cls, value: dict[str, JsonValue]) -> dict[str, JsonValue]:
        # Logic is exposed through its own field, not as a "setting".
        return {key: item for key, item in value.items() if key != "logic"}


class QuestionOrderIn(BaseModel):
    question_ids: list[int]
