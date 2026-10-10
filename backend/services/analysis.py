from schemas import DesignRecommendations, RoomAnalysis, RoomRequest

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


STYLE_PALETTES = {
    "modern-indian": ["Warm whites with terracotta or ochre accents", "Teak or sheesham wood tones"],
    "minimalist": ["Soft white or greige walls", "One muted accent colour at most"],
    "scandinavian": ["White or pale grey walls", "Light oak, linen and sage accents"],
    "contemporary-luxury": ["Warm ivory with charcoal or deep green accents", "Marble and brushed brass details"],
    "boho": ["Earthy terracotta, mustard and olive", "Natural cane, jute and rattan"],
    "industrial": ["Charcoal, concrete grey and warm brown", "Black metal with aged wood"],
}


def room_metrics(req: RoomRequest) -> dict:
    """Numbers computed from the user's inputs; shared by every analyzer."""
    area = req.length_ft * req.width_ft
    notes = list(STYLE_NOTES[req.style])
    size = _size_category(area)
    if size == "compact":
        notes.append("In a compact room, choose multi-purpose and lighter-scale furniture.")
    return {
        "area_sqft": round(area, 1),
        "volume_cuft": round(area * req.height_ft, 1),
        "size_category": size,
        "budget_tier": _budget_tier(req.budget_inr),
        "style_notes": notes,
        "vastu_notes": VASTU_NOTES if req.vastu else [],
        "suggested_categories": CATEGORIES_BY_ROOM[req.room_type],
    }


def rule_based_recommendations(req: RoomRequest, metrics: dict) -> DesignRecommendations:
    """Generic advice from the inputs only; it cannot see the photo."""
    style = req.style.replace("-", " ")
    compact = metrics["size_category"] == "compact"
    return DesignRecommendations(
        summary=f"General {style} suggestions for a {metrics['size_category']} {req.room_type}. "
        "These are based on your inputs, not on your photo.",
        layout=[
            "Keep a clear walkway of about 3 ft through the room.",
            "Use lighter-scale, multi-purpose furniture." if compact else "Anchor the seating area with a rug.",
        ],
        keep=["Keep built-in features and any furniture already in good condition."],
        replace=[f"Swap mismatched pieces for {style} {c}" for c in metrics["suggested_categories"][:2]],
        colors=STYLE_PALETTES[req.style],
        lighting=["Layer ambient, task and accent lighting.", "Use warm white (2700–3000 K) bulbs."],
        decor=["Add one or two plants and a few textiles in the accent colour."],
        budget_tips=[
            "Prioritise the largest piece you use daily, then add smaller accents.",
            "Repaint before buying furniture; it changes the room the most per rupee.",
        ],
    )


def analyze_room(req: RoomRequest) -> RoomAnalysis:
    metrics = room_metrics(req)
    return RoomAnalysis(
        method="rule_based",
        photo_analyzed=False,
        recommendations=rule_based_recommendations(req, metrics),
        disclaimer="Rule-based suggestions from your inputs only. Your photo was not analysed.",
        **metrics,
    )
