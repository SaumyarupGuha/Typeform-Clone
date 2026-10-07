from fastapi import APIRouter, Request, Response, status

from app.core.deps import DbSession
from app.schemas.form import PublicFormOut
from app.schemas.response import ProgressIn, StartResponseIn, StartResponseOut, SubmitIn, SubmitOut
from app.services import response_service

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
