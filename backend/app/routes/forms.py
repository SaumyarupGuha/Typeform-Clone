from fastapi import APIRouter, Query, Response, status

from app.core.deps import CurrentUser, DbSession
from app.schemas.form import FormCreate, FormOut, FormSummaryOut, FormUpdate
from app.services import form_service

router = APIRouter(prefix="/api/forms", tags=["forms"])


@router.get("", response_model=list[FormSummaryOut])
def list_forms(
    db: DbSession,
    user: CurrentUser,
    search: str | None = Query(default=None, max_length=200),
    status: str | None = Query(default=None, pattern="^(draft|published)$"),
) -> list[FormSummaryOut]:
    return form_service.list_forms(db, user, search, status)


@router.post("", response_model=FormOut, status_code=201)
def create_form(payload: FormCreate, db: DbSession, user: CurrentUser) -> FormOut:
    return FormOut.from_model(form_service.create_form(db, user, payload.title))


@router.get("/{form_id}", response_model=FormOut)
def get_form(form_id: int, db: DbSession, user: CurrentUser) -> FormOut:
    return FormOut.from_model(form_service.get_owned_form(db, user, form_id))


@router.patch("/{form_id}", response_model=FormOut)
def update_form(form_id: int, payload: FormUpdate, db: DbSession, user: CurrentUser) -> FormOut:
    form = form_service.get_owned_form(db, user, form_id)
    return FormOut.from_model(form_service.update_form(db, form, payload))


@router.delete("/{form_id}", status_code=204)
def delete_form(form_id: int, db: DbSession, user: CurrentUser) -> Response:
    form_service.delete_form(db, form_service.get_owned_form(db, user, form_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{form_id}/duplicate", response_model=FormOut, status_code=201)
def duplicate_form(form_id: int, db: DbSession, user: CurrentUser) -> FormOut:
    source = form_service.get_owned_form(db, user, form_id)
    return FormOut.from_model(form_service.duplicate_form(db, user, source))


@router.post("/{form_id}/publish", response_model=FormOut)
def publish_form(form_id: int, db: DbSession, user: CurrentUser) -> FormOut:
    form = form_service.get_owned_form(db, user, form_id)
    return FormOut.from_model(form_service.publish_form(db, form))


@router.post("/{form_id}/unpublish", response_model=FormOut)
def unpublish_form(form_id: int, db: DbSession, user: CurrentUser) -> FormOut:
    form = form_service.get_owned_form(db, user, form_id)
    return FormOut.from_model(form_service.unpublish_form(db, form))
