import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    # Origins allowed by CORS. The first one is also the base of public form links.
    frontend_origins: tuple[str, ...]
    default_user_email: str
    default_user_name: str
    # Folder where uploaded files are stored (on Railway, a path inside the /data volume).
    upload_dir: str

    @property
    def frontend_origin(self) -> str:
        """The primary frontend origin: where public form links point."""
        return self.frontend_origins[0]


def _parse_origins(raw: str) -> tuple[str, ...]:
    return tuple(origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip())


def load_settings() -> Settings:
    return Settings(
        database_url=os.getenv("DATABASE_URL", "sqlite:///./typeform.db"),
        # Comma-separated, e.g. "https://app.vercel.app,http://localhost:3000".
        frontend_origins=_parse_origins(os.getenv("FRONTEND_ORIGIN", "http://localhost:3000,http://127.0.0.1:3000")),
        default_user_email="creator@example.com",
        default_user_name="Default Creator",
        upload_dir=os.getenv("UPLOAD_DIR", "./uploads"),
    )


settings = load_settings()
