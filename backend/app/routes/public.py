from urllib.parse import unquote

from fastapi import APIRouter, Header, Request, Response, status

from app.core.deps import DbSession
from app.schemas.form import PublicFormOut
from app.schemas.response import ProgressIn, StartResponseIn, StartResponseOut, SubmitIn, SubmitOut, UploadedFileOut
from app.services import file_service, response_service

router = APIRouter(prefix="/api/public/forms/{slug}", tags=["public"])


@router.get("", response_model=PublicFormOut)
def get_public_form(slug: str, db: DbSession) -> PublicFormOut:
    return PublicFormOut.from_model(response_service.get_published_form(db, slug))


@router.post("/responses", response_model=StartResponseOut, status_code=201)
def start_response(slug: str, payload: StartResponseIn, request: Request, db: DbSession) -> StartResponseOut:
    response = response_service.start_response(db, slug, payload.metadata, request.headers.get("user-agent"))
    return StartResponseOut(token=response.token)


@router.post("/responses/{token}/submit", response_model=SubmitOut, status_code=201)
def submit_response(slug: str, token: str, payload: SubmitIn, db: DbSession) -> SubmitOut:
    thank_you = response_service.submit_response(db, slug, token, payload)
    return SubmitOut(thank_you_screen=thank_you.thank_you_screen)


@router.put("/responses/{token}/progress", status_code=204)
def save_progress(slug: str, token: str, payload: ProgressIn, db: DbSession) -> Response:
    """Save the answers given so far; called as the respondent moves through the form."""
    response_service.save_progress(db, slug, token, payload)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/responses/{token}/files/{question_id}", response_model=UploadedFileOut, status_code=201)
async def upload_file(
    slug: str,
    token: str,
    question_id: int,
    request: Request,
    db: DbSession,
    x_file_name: str = Header(default="file"),
) -> UploadedFileOut:
    """Upload the file for a file question. The raw file is the request body; its name comes in a header."""
    response, question = response_service.prepare_file_upload(db, slug, token, question_id)
    data = await file_service.read_limited(request, file_service.max_bytes(question))
    stored = file_service.store_file(db, response, question, unquote(x_file_name), request.headers.get("content-type"), data)
    return UploadedFileOut(file_id=stored.id, name=stored.original_name, size=stored.size_bytes)
