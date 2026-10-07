from fastapi import APIRouter, Query, Response, status
from fastapi.responses import FileResponse

from app.core.deps import CurrentUser, DbSession
from app.core.errors import NotFoundError
from app.schemas.response import ResponseDetailOut, ResponseListOut, ResponseStatusFilter
from app.schemas.summary import SummaryOut
from app.services import export_service, file_service, form_service, response_service, summary_service

router = APIRouter(prefix="/api/forms/{form_id}", tags=["results"])


@router.get("/responses", response_model=ResponseListOut)
def list_responses(
    form_id: int,
    db: DbSession,
    user: CurrentUser,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status: ResponseStatusFilter = Query(default="completed"),
) -> ResponseListOut:
    form = form_service.get_owned_form(db, user, form_id)
    return response_service.list_responses(db, form, page, limit, status)


# Declared before /responses/{response_id} so "export.csv" is not parsed as an id.
@router.get("/responses/export.csv")
def export_csv(
    form_id: int, db: DbSession, user: CurrentUser, status: ResponseStatusFilter = Query(default="completed")
) -> Response:
    form = form_service.get_owned_form(db, user, form_id)
    return Response(
        content=export_service.build_csv(db, form, status),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{form.slug}-responses.csv"'},
    )


@router.get("/responses/{response_id}", response_model=ResponseDetailOut)
def get_response(form_id: int, response_id: int, db: DbSession, user: CurrentUser) -> ResponseDetailOut:
    form = form_service.get_owned_form(db, user, form_id)
    return response_service.get_response_detail(db, form, response_id)


@router.delete("/responses/{response_id}", status_code=204)
def delete_response(form_id: int, response_id: int, db: DbSession, user: CurrentUser) -> Response:
    form = form_service.get_owned_form(db, user, form_id)
    response_service.delete_response(db, form, response_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/summary", response_model=SummaryOut)
def get_summary(form_id: int, db: DbSession, user: CurrentUser) -> SummaryOut:
    form = form_service.get_owned_form(db, user, form_id)
    return summary_service.build_summary(db, form)


@router.get("/files/{file_id}")
def download_file(form_id: int, file_id: int, db: DbSession, user: CurrentUser) -> FileResponse:
    """Download a respondent's uploaded file. Owner only, and always as an attachment (never rendered)."""
    form = form_service.get_owned_form(db, user, form_id)
    stored = file_service.get_owned_file(db, form, file_id)
    path = file_service.file_path(stored.storage_key)
    if not path.is_file():
        raise NotFoundError("The file is no longer available")
    return FileResponse(
        path,
        media_type="application/octet-stream",  # never the respondent's claimed type: nothing is rendered inline
        filename=stored.original_name,
        headers={"X-Content-Type-Options": "nosniff"},
    )
