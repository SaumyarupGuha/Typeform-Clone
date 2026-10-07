"""Service-level errors and the handlers that turn them into HTTP responses.

Every error body has the shape
{"detail": {"code": str, "message": str, "errors": {field_or_question_id: message}}}
so the frontend only needs one parser.
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    status_code = 500
    code = "error"

    def __init__(self, message: str, errors: dict[str, str] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.errors = errors or {}


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"

    def __init__(self, message: str = "Not found") -> None:
        super().__init__(message)


class ConflictError(AppError):
    status_code = 409
    code = "conflict"


class ValidationFailedError(AppError):
    status_code = 422
    code = "validation_error"

    def __init__(self, message: str = "Some answers are invalid", errors: dict[str, str] | None = None) -> None:
        super().__init__(message, errors)


def _error_response(status_code: int, code: str, message: str, errors: dict[str, str]) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"detail": {"code": code, "message": message, "errors": errors}},
    )


async def _handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
    return _error_response(exc.status_code, exc.code, exc.message, exc.errors)


async def _handle_request_validation(_request: Request, exc: RequestValidationError) -> JSONResponse:
    # Malformed request bodies/queries: report them in the same shape, keyed by field path.
    errors = {
        ".".join(str(part) for part in err["loc"] if part != "body"): err["msg"]
        for err in exc.errors()
    }
    return _error_response(422, "validation_error", "Invalid request", errors)


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _handle_app_error)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, _handle_request_validation)  # type: ignore[arg-type]
