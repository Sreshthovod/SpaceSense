"""Settings. Style and room-type ids mirror frontend/src/data/sampleData.js."""
import os
from pathlib import Path

from dotenv import load_dotenv

# backend/.env is the project's source of truth and overrides shell variables, so a stale
# `export GEMINI_API_KEY=...` in a shell profile can't silently replace the project's key.
load_dotenv(Path(__file__).resolve().parent / ".env", override=True)

# Any port on localhost/127.0.0.1, so Vite can pick 5174, 5175... when 5173 is busy.
LOCAL_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"


def get_allowed_origins() -> list[str]:
    """Explicit origins from SPACESENSE_CORS_ORIGINS (comma-separated, "*" ignored); empty if unset."""
    raw = os.getenv("SPACESENSE_CORS_ORIGINS", "")
    return [o.strip().rstrip("/") for o in raw.split(",") if o.strip() and o.strip() != "*"]


def get_allowed_origin_regex() -> str | None:
    """Local development origins are allowed unless an explicit origin list is configured."""
    return None if get_allowed_origins() else LOCAL_ORIGIN_REGEX


ROOM_TYPES = ("living room", "bedroom", "kitchen", "dining room", "home office", "kids room")
STYLES = ("modern-indian", "minimalist", "scandinavian", "contemporary-luxury", "boho", "industrial")

MAX_DIMENSION_FT = 100
MAX_BUDGET_INR = 100_000_000
