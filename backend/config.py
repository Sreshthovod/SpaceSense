"""Shared constants. Style and room-type ids mirror frontend/src/data/sampleData.js."""

ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]

ROOM_TYPES = ("living room", "bedroom", "kitchen", "dining room", "home office", "kids room")
STYLES = ("modern-indian", "minimalist", "scandinavian", "contemporary-luxury", "boho", "industrial")

# Same limits as the frontend form (feet / INR).
MAX_DIMENSION_FT = 100
MAX_BUDGET_INR = 100_000_000
