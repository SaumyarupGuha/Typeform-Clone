"""Uploaded files: rules for what is accepted, where the bytes live, and cleaning them up.

Files are written under `settings.upload_dir` with a random name, so the respondent's file name
never decides a path on disk. They are never served to the public: only the form's owner can
download them, always as an attachment.
"""

import re
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.requests import Request

from app.core.config import settings
from app.core.errors import NotFoundError, PayloadTooLargeError, ValidationFailedError
from app.models.file import UploadedFile
from app.models.form import Form
from app.models.question import Question
from app.models.response import Response

HARD_LIMIT_MB = 25  # whatever a creator chooses, nothing larger is accepted

# Never accepted, whatever the creator allows: files a computer would run.
BLOCKED_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".com", ".scr", ".msi", ".js", ".vbs", ".ps1", ".sh", ".jar", ".dll", ".apk", ".app",
}

# What each "allowed types" setting accepts ("any" accepts everything not blocked above).
PRESET_EXTENSIONS: dict[str, set[str]] = {
    "images": {".png", ".jpg", ".jpeg", ".gif", ".webp"},
    "documents": {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv", ".rtf", ".odt"},
    "media": {".mp3", ".wav", ".m4a", ".ogg", ".mp4", ".mov", ".webm", ".mkv"},
}
ALLOWED_TYPE_CHOICES = ("any", *PRESET_EXTENSIONS)

_CONTENT_TYPE = re.compile(r"^[a-z0-9][a-z0-9!#$&^_.+-]*/[a-z0-9][a-z0-9!#$&^_.+-]*$")


def upload_root() -> Path:
    root = Path(settings.upload_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def file_path(storage_key: str) -> Path:
    return upload_root() / storage_key


def clean_name(raw: str) -> str:
    """The respondent's file name, made safe to store and show: no folders, no control characters."""
    name = Path(raw.replace("\\", "/")).name
    name = "".join(ch for ch in name if ch.isprintable()).strip()
    return name[:200] or "file"


def clean_content_type(raw: str | None) -> str:
    value = (raw or "").split(";")[0].strip().lower()
    return value if _CONTENT_TYPE.match(value) else "application/octet-stream"


def max_bytes(question: Question) -> int:
    limit_mb = question.properties.get("max_size_mb", 10)
    limit_mb = limit_mb if isinstance(limit_mb, int) and not isinstance(limit_mb, bool) else 10
    return min(limit_mb, HARD_LIMIT_MB) * 1024 * 1024


def type_error(question: Question, filename: str) -> str | None:
    extension = Path(filename).suffix.lower()
    if extension in BLOCKED_EXTENSIONS:
        return "This type of file cannot be uploaded"
    allowed = str(question.properties.get("allowed_types", "any"))
    if allowed != "any" and extension not in PRESET_EXTENSIONS.get(allowed, set()):
        return f"Please upload a file of this kind: {', '.join(sorted(PRESET_EXTENSIONS.get(allowed, set())))}"
    return None


async def read_limited(request: Request, limit: int) -> bytes:
    """Read an upload's body, refusing it as soon as it is larger than `limit` bytes."""
    too_large = PayloadTooLargeError(f"This file is too large. The limit is {limit // (1024 * 1024)} MB.")
    declared = request.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > limit:
        raise too_large  # refuse before reading anything
    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > limit:
            raise too_large
        chunks.append(chunk)
    return b"".join(chunks)


def store_file(
    db: Session,
    response: Response,
    question: Question,
    filename: str,
    content_type: str | None,
    data: bytes,
) -> UploadedFile:
    """Save the bytes and record them. A second upload for the same question replaces the first."""
    name = clean_name(filename)
    if not data:
        raise ValidationFailedError("The file is empty")
    if len(data) > max_bytes(question):
        raise PayloadTooLargeError(f"This file is too large. The limit is {max_bytes(question) // (1024 * 1024)} MB.")
    message = type_error(question, name)
    if message:
        raise ValidationFailedError(message)

    replaced = db.scalar(
        select(UploadedFile).where(UploadedFile.response_id == response.id, UploadedFile.question_id == question.id)
    )
    old_key = replaced.storage_key if replaced else None
    if replaced:
        db.delete(replaced)
        db.flush()

    storage_key = f"{uuid.uuid4().hex}{Path(name).suffix.lower()[:12]}"
    file_path(storage_key).write_bytes(data)
    record = UploadedFile(
        response_id=response.id,
        question_id=question.id,
        original_name=name,
        content_type=clean_content_type(content_type),
        size_bytes=len(data),
        storage_key=storage_key,
    )
    db.add(record)
    try:
        db.commit()
    except Exception:
        db.rollback()
        file_path(storage_key).unlink(missing_ok=True)  # do not leave bytes nobody points at
        raise
    if old_key:
        delete_stored([old_key])
    return record


def get_file_for_response(db: Session, response_id: int, question_id: int) -> UploadedFile | None:
    return db.scalar(
        select(UploadedFile).where(UploadedFile.response_id == response_id, UploadedFile.question_id == question_id)
    )


def get_owned_file(db: Session, form: Form, file_id: int) -> UploadedFile:
    record = db.scalar(
        select(UploadedFile).join(Response, Response.id == UploadedFile.response_id).where(
            UploadedFile.id == file_id, Response.form_id == form.id
        )
    )
    if record is None:
        raise NotFoundError("File not found")
    return record


# ---------- Cleaning up ----------


def delete_stored(storage_keys: list[str]) -> None:
    """Remove files from disk. Best effort: a missing file is not an error."""
    for key in storage_keys:
        file_path(key).unlink(missing_ok=True)


def keys_for_response(db: Session, response_id: int) -> list[str]:
    return list(db.scalars(select(UploadedFile.storage_key).where(UploadedFile.response_id == response_id)))


def keys_for_form(db: Session, form_id: int) -> list[str]:
    return list(
        db.scalars(
            select(UploadedFile.storage_key)
            .join(Response, Response.id == UploadedFile.response_id)
            .where(Response.form_id == form_id)
        )
    )
