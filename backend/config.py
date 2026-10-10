"""Settings. Style and room-type ids mirror frontend/src/data/sampleData.js."""
import os

DEFAULT_ORIGINS = (
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"
)


def get_allowed_origins() -> list[str]:
    """Comma-separated list from SPACESENSE_CORS_ORIGINS; defaults to the local Vite dev/preview origins."""
    raw = os.getenv("SPACESENSE_CORS_ORIGINS", DEFAULT_ORIGINS)
    return [o.strip().rstrip("/") for o in raw.split(",") if o.strip() and o.strip() != "*"]


ROOM_TYPES = ("living room", "bedroom", "kitchen", "dining room", "home office", "kids room")
STYLES = ("modern-indian", "minimalist", "scandinavian", "contemporary-luxury", "boho", "industrial")

MAX_DIMENSION_FT = 100
MAX_BUDGET_INR = 100_000_000
