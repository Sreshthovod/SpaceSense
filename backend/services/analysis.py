from schemas import RoomAnalysis, RoomRequest

STYLE_NOTES = {
    "modern-indian": ["Warm timber, earthy tones and brass accents suit this style."],
    "minimalist": ["Keep surfaces clear and limit the palette to two or three tones."],
    "scandinavian": ["Pale woods, linen and soft layered lighting work well."],
    "contemporary-luxury": ["Use fewer, higher-quality pieces with a symmetrical layout."],
    "boho": ["Layer rugs, plants and textiles; mix natural materials."],
    "industrial": ["Pair dark metal and raw wood with warm lighting to soften the look."],
}

VASTU_NOTES = [
    "Place heavy furniture along the south or west walls.",
    "Keep the north-east corner light and uncluttered.",
    "Avoid mirrors that face the main entrance.",
]

CATEGORIES_BY_ROOM = {
    "living room": ["seating", "tables", "storage", "lighting", "decor"],
    "bedroom": ["beds", "storage", "tables", "lighting", "decor"],
    "kitchen": ["tables", "seating", "storage", "lighting"],
    "dining room": ["tables", "seating", "lighting", "decor"],
    "home office": ["tables", "seating", "storage", "lighting"],
    "kids room": ["beds", "tables", "storage", "decor"],
}


def _size_category(area: float) -> str:
    if area < 100:
        return "compact"
    if area < 250:
        return "medium"
    return "spacious"


def _budget_tier(budget: float) -> str:
    if budget < 50_000:
        return "essentials"
    if budget < 200_000:
        return "mid-range"
    return "premium"


def analyze_room(req: RoomRequest) -> RoomAnalysis:
    area = req.length_ft * req.width_ft
    notes = list(STYLE_NOTES[req.style])
    size = _size_category(area)
    if size == "compact":
        notes.append("In a compact room, choose multi-purpose and lighter-scale furniture.")
    return RoomAnalysis(
        area_sqft=round(area, 1),
        volume_cuft=round(area * req.height_ft, 1),
        size_category=size,
        budget_tier=_budget_tier(req.budget_inr),
        style_notes=notes,
        vastu_notes=VASTU_NOTES if req.vastu else [],
        suggested_categories=CATEGORIES_BY_ROOM[req.room_type],
        disclaimer="Rule-based estimate from your inputs only. Your photo is not analysed yet.",
    )
