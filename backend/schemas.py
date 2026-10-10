from datetime import date
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from config import (
    DIRECTIONS,
    MAX_BUDGET_INR,
    MAX_DIMENSION_FT,
    PRODUCT_CATEGORIES,
    RETAILER_DOMAINS,
    ROOM_TYPES,
    STYLES,
)


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




def retailer_for_url(url: str) -> str | None:
    """The supported retailer that owns an https URL, or None."""
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        return None
    host = parsed.hostname.lower()
    for name, domains in RETAILER_DOMAINS.items():
        if any(host == d or host.endswith("." + d) for d in domains):
            return name
    return None


class Product(BaseModel):
    """One catalog entry or provider result.

    A product is either *verified* (a retailer product page, the listed price read from it and
    the date it was checked) or an *unpriced suggestion* (a generic idea with no price, which the
    UI pairs with retailer search links). There is no "estimated" price: an unknown price stays
    unknown, so nothing invented can end up in a budget total.
    """

    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    category: str
    styles: list[str] = Field(min_length=1)
    room_types: list[str] = Field(min_length=1)
    colors: list[str] = []
    why: str = Field(min_length=1)  # why it suits the room/style; curated, not AI-written
    quantity: int = Field(default=1, ge=1, le=12)
    dimensions: str | None = None
    retailer: str | None = None
    product_url: str | None = None
    image_url: str | None = None
    price_inr: int | None = Field(default=None, gt=0)  # listed price per piece, incl. whatever the retailer includes
    price_status: Literal["verified", "unknown"] = "unknown"
    availability: Literal["in_stock", "out_of_stock"] | None = None
    last_checked: date | None = None
    source: str = "local_catalog"
    search_query: str | None = None

    @field_validator("category")
    @classmethod
    def _category(cls, v: str) -> str:
        if v not in PRODUCT_CATEGORIES:
            raise ValueError(f"must be one of: {', '.join(PRODUCT_CATEGORIES)}")
        return v

    @model_validator(mode="after")
    def _no_unverified_details(self) -> "Product":
        if self.product_url is not None:
            owner = retailer_for_url(self.product_url)
            if owner is None:
                raise ValueError("product_url must be an https link on a supported retailer")
            if self.retailer != owner:
                raise ValueError(f"retailer must be {owner!r} for this product_url")
        verified = self.price_status == "verified"
        if verified and (self.price_inr is None or self.product_url is None or self.last_checked is None):
            raise ValueError("a verified product needs price_inr, product_url and last_checked")
        if not verified and (self.price_inr is not None or self.availability is not None or self.image_url is not None):
            raise ValueError("price, availability and image are only allowed on verified products")
        if self.image_url is not None and not self.image_url.startswith("https://"):
            raise ValueError("image_url must be https")
        if self.product_url is None and not self.search_query:
            raise ValueError("a product without a product_url needs a search_query for retailer search links")
        return self


class RetailerLink(BaseModel):
    retailer: str
    url: str
    kind: Literal["product", "search"]  # "search" = the retailer's own search page; results are not checked


class ProductRecommendation(Product):
    kind: Literal["verified_product", "suggestion"]
    selected: bool  # part of the suggested in-budget plan
    line_total_inr: int | None  # price_inr * quantity, or None when the price is unknown
    links: list[RetailerLink]
    matched_colors: list[str] = []
    notes: list[str] = []


class ProductRequest(RoomRequest):
    """Room details plus, optionally, the design advice the user received, to focus the picks."""

    recommendations: DesignRecommendations | None = None
    categories: list[str] | None = Field(default=None, max_length=len(PRODUCT_CATEGORIES))

    @field_validator("categories")
    @classmethod
    def _categories(cls, v: list[str] | None) -> list[str] | None:
        if v is not None and any(c not in PRODUCT_CATEGORIES for c in v):
            raise ValueError(f"each category must be one of: {', '.join(PRODUCT_CATEGORIES)}")
        return v


class ProductRecommendations(BaseModel):
    """Totals are computed in code from verified prices only. Unpriced items never count."""

    sources: list[str]
    currency: Literal["INR"] = "INR"
    items: list[ProductRecommendation]
    budget_inr: float
    total_inr: int  # sum of line_total_inr over selected items
    remaining_inr: float
    unpriced_count: int
    shortfall_inr: int | None = None  # set when not even the cheapest relevant priced item fits
    excluded_costs: str
    note: str | None = None
    notices: list[str] = []  # e.g. an external provider was unavailable


# --- 3D Room Designer budget -------------------------------------------------------------------

STUDIO_UID = r"^[A-Za-z0-9_-]{1,64}$"


class StudioItem(BaseModel):
    """One placed designer item. Only ids are sent: the server looks every price up itself."""

    model_config = ConfigDict(extra="forbid")  # a client-sent price is rejected, not ignored

    uid: str = Field(pattern=STUDIO_UID)
    type: str = Field(min_length=1, max_length=40)
    product_id: str | None = Field(default=None, min_length=1, max_length=80)
    label: str | None = Field(default=None, max_length=80)  # the user's own name for it, echoed back


class StudioSurface(BaseModel):
    """Walls or floor. Listed so the breakdown shows them; the catalog has no priced finishes."""

    model_config = ConfigDict(extra="forbid")

    id: Literal["walls", "floor"]
    label: str = Field(min_length=1, max_length=80)


class StudioPriceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    budget_inr: float = Field(ge=0, le=MAX_BUDGET_INR, allow_inf_nan=False)
    style: str | None = None
    items: list[StudioItem] = Field(default_factory=list, max_length=300)
    surfaces: list[StudioSurface] = Field(default_factory=list, max_length=2)

    @field_validator("style")
    @classmethod
    def _style(cls, v: str | None) -> str | None:
        if v is not None and v not in STYLES:
            raise ValueError(f"must be one of: {', '.join(STYLES)}")
        return v

    @model_validator(mode="after")
    def _unique(self) -> "StudioPriceRequest":
        uids = [i.uid for i in self.items]
        if len(uids) != len(set(uids)):
            raise ValueError("item uids must be unique")
        if len({s.id for s in self.surfaces}) != len(self.surfaces):
            raise ValueError("each surface may appear once")
        return self


class StudioProduct(BaseModel):
    """A verified catalog product a designer item can stand for."""

    product_id: str
    name: str
    retailer: str
    product_url: str
    image_url: str | None
    price_inr: int
    last_checked: date
    listed_size: str | None  # exactly as the retailer lists it
    availability: Literal["in_stock", "out_of_stock"] | None
    styles: list[str]


class StudioType(BaseModel):
    category: str
    products: list[StudioProduct]


class StudioCatalog(BaseModel):
    currency: Literal["INR"] = "INR"
    budget_categories: dict[str, str]
    types: dict[str, StudioType]
    excluded_costs: str


class StudioLine(BaseModel):
    uid: str | None  # None for walls and floor
    type: str
    label: str
    category: str
    product: StudioProduct | None
    price_inr: int | None
    price_status: Literal["verified", "unavailable"]
    reason: Literal["generic", "no_products", "unverified", "finish"] | None = None


class StudioCategoryTotal(BaseModel):
    id: str
    label: str
    total_inr: int
    priced_count: int
    unpriced_count: int


class StudioSuggestion(BaseModel):
    type: str
    product: StudioProduct


class StudioPrice(BaseModel):
    """Every number here is computed on the server from catalog prices. Unpriced lines never count."""

    currency: Literal["INR"] = "INR"
    budget_inr: float
    total_inr: int
    remaining_inr: float
    over_budget_inr: float | None
    used_ratio: float | None  # total / budget; None when the budget is 0
    unpriced_count: int
    categories: list[StudioCategoryTotal]
    lines: list[StudioLine]
    suggestions: list[StudioSuggestion]
    excluded_costs: str
