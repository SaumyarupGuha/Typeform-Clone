from app.core.errors import ValidationFailedError
from app.question_types.base import Properties, QuestionTypeHandler
from app.question_types.choice import DropdownHandler, MultipleChoiceHandler
from app.question_types.files import FileUploadHandler
from app.question_types.numeric import NumberHandler, RatingHandler
from app.question_types.text import EmailHandler, LongTextHandler, ShortTextHandler
from app.question_types.yes_no import YesNoHandler

_HANDLERS: list[QuestionTypeHandler] = [
    ShortTextHandler(),
    LongTextHandler(),
    MultipleChoiceHandler(),
    DropdownHandler(),
    EmailHandler(),
    NumberHandler(),
    YesNoHandler(),
    RatingHandler(),
    FileUploadHandler(),
]

QUESTION_TYPES: dict[str, QuestionTypeHandler] = {handler.name: handler for handler in _HANDLERS}


def get_handler(type_name: str) -> QuestionTypeHandler:
    handler = QUESTION_TYPES.get(type_name)
    if handler is None:
        raise ValidationFailedError(f"Unknown question type: {type_name}")
    return handler


def merge_properties(handler: QuestionTypeHandler, current: Properties, changes: Properties) -> Properties:
    """Apply partial changes over the current settings, dropping keys this type does not know."""
    merged = {**handler.default_properties, **current, **changes}
    return {key: value for key, value in merged.items() if key in handler.default_properties}
