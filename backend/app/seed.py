"""Demo data: the default creator, two published forms with responses and one draft.

Run `python -m app.seed` to seed an empty database, or `python -m app.seed --reset`
to drop every table first. The API also calls `seed_if_empty` on startup so a
fresh deployment is usable immediately. Randomness is seeded for repeatable data.
"""

import argparse
import random
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

from pydantic import JsonValue
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models  # noqa: F401  (registers tables)
from app.core.clock import utcnow
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.models.answer import Answer, AnswerOption
from app.models.form import Form
from app.models.question import Question, QuestionOption
from app.models.response import Response
from app.models.user import User
from app.question_types import QUESTION_TYPES
from app.question_types.base import Properties
from app.schemas.form import FormSettings, ThankYouScreen
from app.services import logic_service
from app.services.form_service import generate_slug

RANDOM_SEED = 42
HISTORY_DAYS = 30

FIRST_NAMES = ["Aarav", "Maya", "Liam", "Sofia", "Noah", "Priya", "Ethan", "Chloe", "Ravi", "Emma", "Lucas", "Zara"]
LAST_NAMES = ["Sharma", "Patel", "Johnson", "Garcia", "Kim", "Nguyen", "Brown", "Rossi", "Singh", "Miller"]

CSAT_COMMENTS = [
    "Really easy to get started, the onboarding was great.",
    "Support answered within minutes. Very happy with the service.",
    "Would love a dark mode and more export options.",
    "The reports are useful but loading them can be slow.",
    "Pricing is fair for what we get.",
    "Please add more integrations with our existing tools.",
    "Overall a big improvement over what we used before.",
]
EVENT_NOTES = [
    "Vegetarian, no nuts please.",
    "Gluten free for me and one guest.",
    "Looking forward to the workshop!",
    "Is there step-free access to the venue?",
    "Vegan meal please.",
]


@dataclass
class QuestionSpec:
    """A question to create plus the hints used to generate realistic answers for it."""

    type: str
    title: str
    description: str | None = None
    required: bool = False
    properties: Properties = field(default_factory=dict)
    options: list[str] = field(default_factory=list)
    weights: list[float] | None = None  # per option / per rating step
    samples: list[str] | None = None  # free-text answers to pick from
    person_field: str | None = None  # "name" or "email": reuse the respondent's identity
    number_range: tuple[int, int] = (1, 10)
    yes_probability: float = 0.5
    skip_probability: float = 0.0  # chance an optional question is left blank
    # Logic jumps written with question positions: {"rules": [{"if": [(position, operator, value)], "jump_to": position | "end"}]}
    logic: dict[str, Any] | None = None


CSAT_QUESTIONS = [
    QuestionSpec("short_text", "What's your name?", required=True, person_field="name"),
    QuestionSpec("email", "What's your email address?", required=True, person_field="email"),
    QuestionSpec(
        "rating", "How would you rate your overall experience?", required=True,
        properties={"steps": 5}, weights=[3, 5, 12, 35, 45],
        # Unhappy customers go straight to the open question instead of the product questions.
        logic={"rules": [{"if": [(2, "less_or_equal", 2)], "jump_to": 8}]},
    ),
    QuestionSpec(
        "multiple_choice", "How did you hear about us?", required=True,
        options=["Search engine", "Social media", "Friend or colleague", "Advertisement", "Other"],
        weights=[30, 25, 25, 12, 8],
    ),
    QuestionSpec(
        "multiple_choice", "Which features do you use most?", description="Choose as many as you like.",
        properties={"allow_multiple": True},
        options=["Dashboard", "Reports", "Integrations", "Mobile app", "Support chat"],
        weights=[40, 30, 15, 20, 12], skip_probability=0.1,
    ),
    QuestionSpec(
        "dropdown", "Which plan are you on?", options=["Free", "Starter", "Pro", "Enterprise"],
        weights=[35, 30, 25, 10], skip_probability=0.1,
    ),
    QuestionSpec("yes_no", "Would you recommend us to a friend?", required=True, yes_probability=0.78),
    QuestionSpec(
        "number", "How many people are on your team?", properties={"min": 1, "max": 500},
        number_range=(1, 60), skip_probability=0.15,
    ),
    QuestionSpec(
        "long_text", "Anything else you'd like to tell us?", samples=CSAT_COMMENTS, skip_probability=0.45,
    ),
]

EVENT_QUESTIONS = [
    QuestionSpec("short_text", "Full name", required=True, person_field="name"),
    QuestionSpec("email", "Email address", required=True, person_field="email"),
    QuestionSpec(
        "dropdown", "Which session will you attend?", required=True,
        options=["Morning keynote", "Workshop A", "Workshop B", "Closing panel"], weights=[40, 25, 20, 15],
    ),
    QuestionSpec(
        "number", "How many guests are you bringing?", properties={"min": 0, "max": 5},
        number_range=(0, 3), required=True,
    ),
    QuestionSpec(
        "yes_no", "Do you have any dietary requirements?", yes_probability=0.3,
        # No requirements: nothing more to ask, finish the form.
        logic={"rules": [{"if": [(4, "is", False)], "jump_to": "end"}]},
    ),
    QuestionSpec("long_text", "Tell us more or ask a question", samples=EVENT_NOTES, skip_probability=0.55),
]

RESEARCH_QUESTIONS = [
    QuestionSpec("short_text", "What's your job title?", required=True),
    QuestionSpec(
        "multiple_choice", "What do you mainly use our product for?",
        options=["Surveys", "Lead capture", "Quizzes", "Registrations"],
    ),
    QuestionSpec("rating", "How satisfied are you with your current tool?", properties={"steps": 5}),
    QuestionSpec(
        "file_upload", "Upload a screenshot of how you work today",
        description="Optional. It helps us understand your setup.",
        properties={"max_size_mb": 10, "allowed_types": "images"},
    ),
]


def _build_question(spec: QuestionSpec, position: int) -> Question:
    handler = QUESTION_TYPES[spec.type]
    return Question(
        position=position,
        type=spec.type,
        title=spec.title,
        description=spec.description,
        required=spec.required,
        properties={**handler.default_properties, **spec.properties},
        options=[QuestionOption(position=i, label=label) for i, label in enumerate(spec.options)],
    )


def _create_form(
    db: Session,
    owner: User,
    title: str,
    specs: list[QuestionSpec],
    published: bool,
    age_days: int,
) -> tuple[Form, list[tuple[QuestionSpec, Question]]]:
    created = utcnow() - timedelta(days=age_days)
    form = Form(
        owner_id=owner.id,
        title=title,
        slug=generate_slug(db),
        status="published" if published else "draft",
        published_at=created if published else None,
        created_at=created,
        updated_at=created,
        settings=FormSettings(
            thank_you_screen=ThankYouScreen(title="Thanks for your time!", description="We read every response.")
        ).model_dump(),
    )
    pairs = [(spec, _build_question(spec, position)) for position, spec in enumerate(specs)]
    form.questions = [question for _, question in pairs]
    db.add(form)
    db.flush()  # assigns ids to the form, questions and options
    _apply_logic(pairs)
    return form, pairs


def _apply_logic(pairs: list[tuple[QuestionSpec, Question]]) -> None:
    """Turn the position-based rules of each spec into stored rules that use real question ids."""
    for spec, question in pairs:
        if not spec.logic:
            continue

        def target(position: int | str) -> int | str:
            return position if position == "end" else pairs[int(position)][1].id

        rules = [
            {
                "match": "all",
                "conditions": [
                    {"question_id": pairs[position][1].id, "operator": operator, "value": value}
                    for position, operator, value in rule["if"]
                ],
                "jump_to": target(rule["jump_to"]),
            }
            for rule in spec.logic["rules"]
        ]
        question.properties = {**question.properties, "logic": {"rules": rules, "otherwise": None}}


def _generate_value(
    rng: random.Random, spec: QuestionSpec, question: Question, person: tuple[str, str]
) -> JsonValue:
    if spec.type in ("short_text", "email") and spec.person_field:
        return person[0] if spec.person_field == "name" else person[1]
    if spec.type == "short_text":
        return rng.choice(["Designer", "Engineer", "Product Manager", "Founder"])
    if spec.type == "long_text":
        return rng.choice(spec.samples or ["No comment."])
    if spec.type == "rating":
        steps = int(question.properties.get("steps", 5))
        return rng.choices(range(1, steps + 1), weights=spec.weights)[0]
    if spec.type == "number":
        return rng.randint(*spec.number_range)
    if spec.type == "yes_no":
        return rng.random() < spec.yes_probability
    option_ids = [option.id for option in question.options]
    weights = spec.weights or [1] * len(option_ids)
    if spec.type == "dropdown" or not question.properties.get("allow_multiple"):
        picked = rng.choices(option_ids, weights=weights)[0]
        return picked if spec.type == "dropdown" else [picked]
    # Multi-select: draw 1-3 distinct options, favouring the heavier weights.
    chosen: set[int] = set()
    for _ in range(rng.randint(1, 3)):
        chosen.add(rng.choices(option_ids, weights=weights)[0])
    return sorted(chosen)


def _answer_along_path(
    rng: random.Random,
    pairs: list[tuple[QuestionSpec, Question]],
    response: Response,
    person: tuple[str, str],
    stop_after: int | None,
) -> None:
    """Answer questions the way a respondent would: follow the logic jumps, and optionally stop early."""
    questions = [question for _, question in pairs]
    answers: dict[int, JsonValue] = {}
    index: int | None = 0
    visited = 0
    while index is not None and (stop_after is None or visited < stop_after):
        spec, question = pairs[index]
        if spec.required or rng.random() >= spec.skip_probability:
            value = _generate_value(rng, spec, question, person)
            answers[question.id] = value
            columns = QUESTION_TYPES[spec.type].to_columns(value)
            response.answers.append(
                Answer(
                    question_id=question.id,
                    text_value=columns.text_value,
                    number_value=columns.number_value,
                    boolean_value=columns.boolean_value,
                    answer_options=[AnswerOption(option_id=oid) for oid in columns.option_ids],
                )
            )
        visited += 1
        index = logic_service.next_index(questions, index, answers)


def _seed_responses(
    db: Session,
    rng: random.Random,
    form: Form,
    pairs: list[tuple[QuestionSpec, Question]],
    completed: int,
    in_progress: int,
) -> None:
    now = utcnow()
    for index in range(completed + in_progress):
        started = now - timedelta(days=rng.uniform(0, HISTORY_DAYS), minutes=rng.randint(0, 600))
        response = Response(form_id=form.id, token=f"seed-{form.id}-{index}", started_at=started)
        full_name = f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"
        person = (full_name, full_name.lower().replace(" ", ".") + "@example.com")
        if index < completed:
            response.status = "completed"
            response.submitted_at = started + timedelta(seconds=rng.randint(45, 420))
            _answer_along_path(rng, pairs, response, person, stop_after=None)
        else:
            # An abandoned response: the respondent answered the first few questions and left.
            _answer_along_path(rng, pairs, response, person, stop_after=rng.randint(1, max(1, len(pairs) - 2)))
        db.add(response)


def _ensure_default_user(db: Session) -> User:
    user = db.scalar(select(User).where(User.email == settings.default_user_email))
    if user is None:
        user = User(email=settings.default_user_email, name=settings.default_user_name)
        db.add(user)
        db.flush()
    return user


def seed_database(db: Session) -> None:
    rng = random.Random(RANDOM_SEED)
    owner = _ensure_default_user(db)

    csat, csat_pairs = _create_form(db, owner, "Customer Satisfaction Survey", CSAT_QUESTIONS, True, age_days=32)
    _seed_responses(db, rng, csat, csat_pairs, completed=40, in_progress=8)

    event, event_pairs = _create_form(db, owner, "Event Registration", EVENT_QUESTIONS, True, age_days=20)
    _seed_responses(db, rng, event, event_pairs, completed=15, in_progress=0)

    _create_form(db, owner, "Product Research", RESEARCH_QUESTIONS, False, age_days=3)
    db.commit()


def seed_if_empty() -> None:
    with SessionLocal() as db:
        if (db.scalar(select(func.count()).select_from(User)) or 0) == 0:
            seed_database(db)


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the database with demo data.")
    parser.add_argument("--reset", action="store_true", help="drop and recreate all tables first")
    args = parser.parse_args()

    if args.reset:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if (db.scalar(select(func.count()).select_from(User)) or 0) > 0:
            print("Database already has data; use --reset to start over.")
            return
        seed_database(db)
    print("Seeded 3 forms.")


if __name__ == "__main__":
    main()
