from fastapi import APIRouter, Response, status

from app.core.deps import CurrentUser, DbSession
from app.schemas.question import QuestionCreate, QuestionOrderIn, QuestionOut, QuestionUpdate
from app.services import form_service, question_service

router = APIRouter(prefix="/api", tags=["questions"])


@router.post("/forms/{form_id}/questions", response_model=QuestionOut, status_code=201)
def add_question(form_id: int, payload: QuestionCreate, db: DbSession, user: CurrentUser) -> QuestionOut:
    form = form_service.get_owned_form(db, user, form_id)
    return QuestionOut.model_validate(question_service.add_question(db, form, payload))


@router.put("/forms/{form_id}/questions/order", response_model=list[QuestionOut])
def reorder_questions(form_id: int, payload: QuestionOrderIn, db: DbSession, user: CurrentUser) -> list[QuestionOut]:
    form = form_service.get_owned_form(db, user, form_id)
    ordered = question_service.reorder_questions(db, form, payload.question_ids)
    return [QuestionOut.model_validate(question) for question in ordered]


@router.patch("/questions/{question_id}", response_model=QuestionOut)
def update_question(question_id: int, payload: QuestionUpdate, db: DbSession, user: CurrentUser) -> QuestionOut:
    question = question_service.get_owned_question(db, user, question_id)
    return QuestionOut.model_validate(question_service.update_question(db, question, payload))


@router.delete("/questions/{question_id}", status_code=204)
def delete_question(question_id: int, db: DbSession, user: CurrentUser) -> Response:
    question_service.delete_question(db, question_service.get_owned_question(db, user, question_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/questions/{question_id}/duplicate", response_model=QuestionOut, status_code=201)
def duplicate_question(question_id: int, db: DbSession, user: CurrentUser) -> QuestionOut:
    question = question_service.get_owned_question(db, user, question_id)
    return QuestionOut.model_validate(question_service.duplicate_question(db, question))
