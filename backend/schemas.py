from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from config import MAX_BUDGET_INR, MAX_DIMENSION_FT, ROOM_TYPES, STYLES


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


class RoomAnalysis(BaseModel):
    method: str = "rule_based"
    area_sqft: float
    volume_cuft: float
    size_category: str
    budget_tier: str
    style_notes: list[str]
    vastu_notes: list[str]
    suggested_categories: list[str]
    disclaimer: str


class DesignResponse(BaseModel):
    """Placeholder until an image model is integrated: never contains a generated image."""

    status: Literal["mock"] = "mock"
    is_ai_generated: Literal[False] = False
    image_url: None = None
    message: str
    request_summary: RoomRequest


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
