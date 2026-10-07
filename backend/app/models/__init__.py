# Importing every model here registers all tables on Base.metadata.
from app.models.answer import Answer, AnswerOption
from app.models.file import UploadedFile
from app.models.form import Form
from app.models.question import Question, QuestionOption
from app.models.response import Response
from app.models.user import User

__all__ = ["Answer", "AnswerOption", "Form", "Question", "QuestionOption", "Response", "UploadedFile", "User"]
