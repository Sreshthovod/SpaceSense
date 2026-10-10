from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from config import DIRECTIONS, MAX_BUDGET_INR, MAX_DIMENSION_FT, ROOM_TYPES, STYLES


class RoomRequest(BaseModel):
    """Room details shared by every endpoint. Dimensions are in feet, money in INR."""

    model_config = ConfigDict(extra="forbid")  # unknown fields are rejected

    room_type: str = Field(examples=["living room"])
    length_ft: float = Field(gt=0, le=MAX_DIMENSION_FT, allow_inf_nan=False)
    width_ft: float = Field(gt=0, le=MAX_DIMENSION_FT, allow_inf_nan=False)
    height_ft: float = Field(gt=0, le=MAX_DIMENSION_FT, allow_inf_nan=False)
    style: str = Field(examples=["scandinavian"])
    budget_inr: float = Field(ge=0, le=MAX_BUDGET_INR, allow_inf_nan=False)
    vastu: bool = False
    # Compass direction you face when you walk in through the room's main door (used with vastu).
    entry_direction: str | None = Field(default=None, examples=["north-east"])

    @field_validator("entry_direction")
    @classmethod
    def _entry_direction(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        v = v.strip().lower()
        if v not in DIRECTIONS:
            raise ValueError(f"must be one of: {', '.join(DIRECTIONS)}")
        return v

    @field_validator("room_type")
    @classmethod
    def _room_type(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ROOM_TYPES:
            raise ValueError(f"must be one of: {', '.join(ROOM_TYPES)}")
        return v

    @field_validator("style")
    @classmethod
    def _style(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in STYLES:
            raise ValueError(f"must be one of: {', '.join(STYLES)}")
        return v


class DesignRecommendations(BaseModel):
    """Written design advice. Every list holds short, self-contained suggestions."""

    summary: str = ""
    layout: list[str] = []
    keep: list[str] = []
    replace: list[str] = []
    colors: list[str] = []
    lighting: list[str] = []
    decor: list[str] = []
    budget_tips: list[str] = []
    vastu: list[str] = []  # photo-specific Vastu observations (AI analysis, when Vastu is on)


class PhotoInsights(BaseModel):
    """Measured with OpenCV from the uploaded photo (no AI involved)."""

    width: int
    height: int
    sharpness: float
    brightness: Literal["dark", "balanced", "bright"]
    brightness_level: float  # 0 (black) to 1 (white)
    average_saturation: float  # 0 (grey) to 1 (vivid)
    dominant_colors: list[str]  # hex, most common first
    usable: bool  # False when the photo is too blurry or too dark to analyse well
    issues: list[str] = []


class PreservationCheck(BaseModel):
    """How closely an edited photo keeps the original's structure (a heuristic, not proof)."""

    score: float  # 0 to 1
    preserved: bool
    note: str


class RoomAnalysis(BaseModel):
    method: Literal["rule_based", "gemini"] = "rule_based"
    photo_analyzed: bool = False
    area_sqft: float
    volume_cuft: float
    size_category: str
    budget_tier: str
    style_notes: list[str]
    vastu_notes: list[str]
    suggested_categories: list[str]
    recommendations: DesignRecommendations
    disclaimer: str
    photo_insights: PhotoInsights | None = None


MAX_INSTRUCTIONS = 40
MAX_INSTRUCTION_CHARS = 500
MAX_NOTES_CHARS = 1000


class EditInstructions(BaseModel):
    """The recommendations the user approved, sent with the original photo."""

    model_config = ConfigDict(extra="forbid")

    items: list[str] = Field(min_length=1, max_length=MAX_INSTRUCTIONS)
    notes: str = Field(default="", max_length=MAX_NOTES_CHARS)

    @field_validator("items")
    @classmethod
    def _items(cls, v: list[str]) -> list[str]:
        cleaned = [i.strip() for i in v if i.strip()]
        if not cleaned:
            raise ValueError("at least one approved change is required")
        if any(len(i) > MAX_INSTRUCTION_CHARS for i in cleaned):
            raise ValueError(f"each change must be at most {MAX_INSTRUCTION_CHARS} characters")
        return cleaned


class DesignResponse(BaseModel):
    """Result of editing the user's original photo.

    `status="edited"` always carries the edited image; `status="mock"` never does.
    """

    status: Literal["edited", "mock"]
    provider: str
    is_ai_generated: bool
    image_url: str | None = None  # data: URL of the edited image
    message: str
    instructions_used: list[str]
    preservation: PreservationCheck | None = None


MAX_CHAT_MESSAGES = 30
MAX_CHAT_CHARS = 2000


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_CHAT_CHARS)


class ChatRequest(BaseModel):
    """The conversation so far (the server keeps no state), plus the recommendations shown to the user."""

    model_config = ConfigDict(extra="forbid")

    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_CHAT_MESSAGES)
    recommendations: DesignRecommendations | None = None

    @field_validator("messages")
    @classmethod
    def _last_is_user(cls, v: list[ChatMessage]) -> list[ChatMessage]:
        if v[-1].role != "user":
            raise ValueError("the last message must be from the user")
        if not v[-1].content.strip():
            raise ValueError("the last message is empty")
        return v


class ChatReply(BaseModel):
    reply: str
    provider: str
    is_ai_generated: bool


class Product(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    category: str = Field(min_length=1)
    price_inr: int = Field(gt=0)
    dimensions: str
    styles: list[str] = Field(min_length=1)
    room_types: list[str] = Field(min_length=1)


class ProductRecommendations(BaseModel):
    source: str = "sample_catalog"
    items: list[Product]
    total_inr: int
    budget_inr: float
    remaining_inr: float
    note: str | None = None
