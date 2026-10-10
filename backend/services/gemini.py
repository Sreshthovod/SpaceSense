"""Gemini calls. Analysis (text out) and photo editing (image out) are deliberately separate.

The client is passed in, so tests use fakes and never need credentials or network access.
"""
import base64
import json
import logging

from pydantic import ValidationError

from schemas import ChatRequest, DesignRecommendations, EditInstructions, LayoutOptions, RoomRequest, StudioLayout
from services.images import RoomImage
from services.vastu import describe_for_prompt as vastu_prompt

logger = logging.getLogger("spacesense.gemini")


class GeminiCallError(Exception):
    """The model call failed or returned something unusable. The message is for logs only.

    `reason` is one of: quota, auth, timeout, no_image, bad_output, unavailable.
    """

    def __init__(self, message: str, reason: str = "unavailable"):
        super().__init__(message)
        self.reason = reason


def _classify(exc: Exception) -> str:
    code = getattr(exc, "code", None)
    if code == 429:
        return "quota"
    if code in (401, 403):
        return "auth"
    if code == 504 or isinstance(exc, TimeoutError) or "timeout" in type(exc).__name__.lower():
        return "timeout"
    return "unavailable"


def _types():
    from google.genai import types  # imported lazily so the app runs without the SDK in mock mode

    return types


def _call(client, **kwargs):
    try:
        return client.models.generate_content(**kwargs)
    except Exception as exc:  # SDK, HTTP, timeout and quota errors all surface as a provider failure
        raise GeminiCallError(f"{type(exc).__name__}: {exc}", _classify(exc)) from exc


# --- analysis: photo in, structured text out (never requests an image) ---

_LIST = {"type": "array", "items": {"type": "string"}}
ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {"summary": {"type": "string"}, **{k: _LIST for k in
                   ("layout", "keep", "replace", "colors", "lighting", "decor", "budget_tips", "vastu")}},
    "required": ["summary", "layout", "keep", "replace", "colors", "lighting", "decor", "budget_tips"],
}

def build_analysis_prompt(req: RoomRequest, metrics: dict, photo_facts: str = "") -> str:
    vastu = vastu_prompt(req)
    return (
        f"You are an interior design consultant. Study the attached photo of the user's {req.room_type}. "
        f"The user is planning this space as a {req.room_type}; treat it as one even if it currently looks "
        "empty or like a different kind of room. "
        f"The room is {req.length_ft} x {req.width_ft} ft with a {req.height_ft} ft ceiling "
        f"({metrics['area_sqft']} sq ft). Preferred style: {req.style.replace('-', ' ')}. "
        f"Total furnishing budget: INR {req.budget_inr:,.0f}. {vastu}\n"
        "Base every point on what is actually visible in the photo. Give short, specific, actionable items:\n"
        "- summary: 2-3 sentences describing the current room and the overall direction\n"
        "- layout: furniture arrangement and circulation improvements\n"
        "- keep: existing items worth keeping (as seen in the photo)\n"
        "- replace: items to replace or add, sized for the room\n"
        "- colors: wall, floor and accent colour recommendations\n"
        "- lighting: lighting improvements\n"
        "- decor: decor and soft-furnishing suggestions\n"
        "- budget_tips: how to prioritise spending within the budget\n"
        "- vastu: only if the user wants Vastu advice, otherwise an empty list\n"
        "Do not invent brands, prices or product links. Do not change walls, doors or windows unless essential."
        + ("\n" + photo_facts if photo_facts else "")
    )


def analyze_with_gemini(client, model: str, req: RoomRequest, image: RoomImage, metrics: dict, photo_facts: str = "") -> DesignRecommendations:
    types = _types()
    response = _call(
        client,
        model=model,
        contents=[types.Part.from_bytes(data=image.data, mime_type=image.mime_type), build_analysis_prompt(req, metrics, photo_facts)],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_json_schema=ANALYSIS_SCHEMA,
            temperature=0.4,
        ),
    )
    try:
        return DesignRecommendations.model_validate(json.loads(response.text or ""))
    except (ValueError, ValidationError) as exc:
        raise GeminiCallError(f"Unusable analysis response: {exc}", "bad_output") from exc


# --- chat: photo + conversation in, text out (never requests an image) ---

def build_chat_system_prompt(req: RoomRequest, metrics: dict, chat: ChatRequest) -> str:
    recs = chat.recommendations.model_dump_json() if chat.recommendations else "none yet"
    vastu = vastu_prompt(req) if req.vastu else "Only mention Vastu if the user asks."
    return (
        "You are SpaceSense, a friendly interior design consultant. Answer questions about the user's room, "
        "shown in the attached photo. The user is planning it as the room type below; treat it as that type "
        "even if it currently looks empty or like a different kind of room. Room: "
        f"{req.room_type}, {req.length_ft} x {req.width_ft} ft, {req.height_ft} ft ceiling ({metrics['area_sqft']} sq ft). "
        f"Preferred style: {req.style.replace('-', ' ')}. Budget: INR {req.budget_inr:,.0f}. {vastu}\n"
        f"Recommendations already given to the user (JSON): {recs}\n"
        "Rules: base answers on what is visible in the photo and the details above; be specific and concise "
        "(under 150 words unless asked for more); use plain text with short paragraphs or '-' bullet lines, no markdown "
        "headings or bold; give prices only as rough INR ranges and say they are estimates; never invent brands, "
        "shops or links; you cannot edit or generate images in this chat, so if asked, explain that the photo "
        "edit is a separate step the user must approve; politely decline questions unrelated to the room or "
        "interior design."
    )


def chat_with_gemini(client, model: str, req: RoomRequest, image: RoomImage, metrics: dict, chat: ChatRequest) -> str:
    types = _types()
    history = []
    for i, m in enumerate(chat.messages):
        parts = [types.Part.from_text(text=m.content)]
        if i == 0:  # attach the photo once, to the first user turn
            parts.insert(0, types.Part.from_bytes(data=image.data, mime_type=image.mime_type))
        history.append(types.Content(role="user" if m.role == "user" else "model", parts=parts))
    response = _call(
        client,
        model=model,
        contents=history,
        config=types.GenerateContentConfig(
            system_instruction=build_chat_system_prompt(req, metrics, chat),
            temperature=0.6,
        ),
    )
    text = (getattr(response, "text", None) or "").strip()
    if not text:
        raise GeminiCallError("Empty chat response", "bad_output")
    return text


# --- editing: original photo + approved changes in, edited photo out ---

PRESERVATION_RULES = (
    "This is an edit of the attached photograph, not a new image. Keep it the same room:\n"
    "- the same camera position, viewpoint, perspective, lens and framing\n"
    "- the same walls, ceiling, floor area, doors, windows, beams and columns, in the same positions and proportions\n"
    "- the same direction of natural light\n"
    "Do not add, remove or move doors, windows or walls, and do not change the room's shape, "
    "unless an approved change below explicitly asks for it. "
    "Do not produce a different room, a collage, a mood board, a split view, text or price labels."
)


def build_edit_prompt(req: RoomRequest, instructions: EditInstructions) -> str:
    changes = "\n".join(f"- {item}" for item in instructions.items)
    notes = f"\nAdditional notes from the user: {instructions.notes}" if instructions.notes else ""
    vastu = " Follow the Vastu placement preferences in the approved changes." if req.vastu else ""
    return (
        f"{PRESERVATION_RULES}\n\n"
        f"Apply only these changes, which the user approved, in a {req.style.replace('-', ' ')} style:\n"
        f"{changes}{notes}\n\n"
        f"Keep furnishings plausible for a total budget of about INR {req.budget_inr:,.0f}.{vastu} "
        "Leave everything not mentioned above as it is in the original photo. "
        "Return a single photorealistic edited photo."
    )


def _first_image(response) -> tuple[bytes, str] | None:
    for candidate in getattr(response, "candidates", None) or []:
        content = getattr(candidate, "content", None)
        for part in getattr(content, "parts", None) or []:
            blob = getattr(part, "inline_data", None)
            if blob is not None and blob.data and (blob.mime_type or "").startswith("image/"):
                return blob.data, blob.mime_type
    return None


def edit_with_gemini(client, model: str, req: RoomRequest, image: RoomImage, instructions: EditInstructions) -> str:
    """Returns the edited image as a data URL. Never falls back to text-to-image generation."""
    types = _types()
    response = _call(
        client,
        model=model,
        contents=[types.Part.from_bytes(data=image.data, mime_type=image.mime_type), build_edit_prompt(req, instructions)],
        config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"]),
    )
    found = _first_image(response)
    if found is None:
        reasons = [str(getattr(c, "finish_reason", "")) for c in getattr(response, "candidates", None) or []]
        raise GeminiCallError(f"No edited image in response (finish reasons: {reasons or 'none'})", "no_image")
    data, mime = found
    return f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"


# --- 3D designer layout: room brief (and optionally a photo) in, structured positions out ---

WALL_NAMES = ["back", "right", "front", "left"]


def layout_schema(options: LayoutOptions) -> dict:
    """The response schema. Piece types are an enum of the ids the designer sent, so the model cannot invent pieces."""
    number = {"type": "number"}
    floor_item = {
        "type": "object",
        "properties": {"type": {"type": "string", "enum": [f.id for f in options.floor]}, "x": number, "z": number, "rotation": number},
        "required": ["type", "x", "z", "rotation"],
    }
    wall_item = {
        "type": "object",
        "properties": {
            "type": {"type": "string", "enum": [w.id for w in options.wall] or ["none"]},
            "wall": {"type": "string", "enum": WALL_NAMES},
            "along": number, "y": number, "w": number, "h": number,
        },
        "required": ["type", "wall", "along"],
    }
    return {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "accent_wall": {"type": "string", "enum": WALL_NAMES},
            "floor": {"type": "array", "items": floor_item},
            "wall": {"type": "array", "items": wall_item},
        },
        "required": ["summary", "floor", "wall"],
    }


def _piece_lines(options: LayoutOptions) -> str:
    floor = [
        f"- {f.id}: {f.name}, {f.w:g} x {f.d:g} x {f.h:g} ft (width x depth x height)"
        + (", round" if f.shape == "round" else "")
        + (", L-shaped: the front-left corner is empty, the chaise is on its right" if f.shape == "l" else "")
        + (", goes against a wall" if f.against_wall else "")
        + (", things can stand on it" if f.surface else "")
        + (", small piece that must stand on a table or cabinet" if f.on_surface else "")
        for f in options.floor
    ]
    wall = [
        f"- {w.id}: {w.name}, {w.w:g} x {w.h:g} ft"
        + (", a door or window cut into the wall" if w.opening else "")
        + (f", usually centred {w.default_y:g} ft above the floor" if w.default_y is not None else "")
        for w in options.wall
    ]
    return "FLOOR PIECES (type ids):\n" + "\n".join(floor) + "\n\nWALL PIECES (type ids):\n" + ("\n".join(wall) or "- none")


def build_layout_prompt(req: RoomRequest, options: LayoutOptions, has_photo: bool) -> str:
    w, ln, h = req.width_ft, req.length_ft, req.height_ft
    photo = (
        "A photo of the room is attached. Use it to notice where the door and windows are and what the room is used for, "
        "and put the door and windows in those places. Do not copy the existing furniture."
        if has_photo
        else "No photo is attached, so choose sensible walls for the door and windows."
    )
    notes = (
        f'\nThe user asked for: "{options.notes}". Treat this as a preference only; the rules below always win.'
        if options.notes
        else ""
    )
    example = ""
    if options.example:
        example = (
            "\n\nHere is a plain starter layout for a room this size, to show the output format and sensible spacing. "
            "Improve on it for this user; do not copy it blindly:\n" + options.example.model_dump_json(exclude_none=True)
        )
    return (
        f"You are arranging furniture in a 3D room planner. Room: {req.room_type}, {w:g} ft wide (x) by {ln:g} ft long (z) "
        f"by {h:g} ft high, {req.style.replace('-', ' ')} style, budget about INR {req.budget_inr:,.0f} (never mention prices).{notes}\n{photo}\n\n"
        f"COORDINATES (feet): the origin is the middle of the floor. x runs across the width from -{w / 2:g} (left wall) to {w / 2:g} (right wall); "
        f"z runs along the length from -{ln / 2:g} (back wall) to {ln / 2:g} (front wall). A floor piece's x, z is its CENTRE. "
        "Rotation is in degrees and sets where the piece's front faces: 0 faces the front wall (use it for pieces against the back wall), "
        "180 faces the back wall (against the front wall), 90 faces the right wall (against the left wall), "
        "270 faces the left wall (against the right wall). At 90 or 270 a piece's width and depth swap.\n"
        "WALL PIECES: wall is back, right, front or left. `along` is the distance in feet from the wall's left end, as seen standing "
        "inside the room facing that wall, to the piece's centre. `y` is the height of its centre above the floor. "
        "Leave w and h out unless you need a non-default size.\n\n"
        + _piece_lines(options)
        + "\n\nRULES:\n"
        "1. Use only the type ids above.\n"
        "2. Every piece must lie fully inside the room, and pieces must not overlap (rugs may lie under furniture).\n"
        "3. Pieces marked 'goes against a wall' sit flush with a wall, with the rotation given above.\n"
        "4. A piece marked 'must stand on a table or cabinet' needs the same x, z as a piece that things can stand on.\n"
        "5. Leave at least 3 ft clear for walking between big pieces, and never block a door.\n"
        f"6. Choose pieces that suit a {req.room_type}: a sensible number of pieces (usually 6 to 18), not every piece in the catalog.\n"
        "7. Always include exactly one door and, if any wall has space, at least one window (usually one or two) as WALL PIECES. "
        "A door needs about 3 ft of free wall and the floor in front of it clear; a window should not sit behind tall furniture.\n"
        "8. Optionally set accent_wall to the wall behind the main piece. Put a one or two sentence description of your idea in summary.\n\n"
        "DESIGN PRINCIPLES (a room should feel balanced and easy to walk through):\n"
        "- Choose one focus (the TV wall, the window, or the wall behind the bed) and arrange the room around it.\n"
        "- Group seating around a coffee table with the seats facing each other or the focus, about 1.5 ft from the table. "
        "A TV unit goes on the wall the seating faces, no more than about 10 ft from it.\n"
        "- Put big pieces (sofa, bed, wardrobe, bookshelf, TV unit) against walls and keep the middle of the room open to cross. "
        "Do not scatter small pieces through the middle.\n"
        "- Use one rug, under the seating group, the dining table or the foot of the bed.\n"
        "- Chairs go along the long sides of a table, facing it. Bedside tables go on both sides of a bed.\n"
        "- Lamps and plants go beside seating, in corners, or on tables, never alone in the middle.\n"
        "- Spread the furniture around the room instead of crowding one side, and hang art above the sofa or bed."
        + example
    )


def layout_with_gemini(client, model: str, req: RoomRequest, image: RoomImage | None, options: LayoutOptions) -> StudioLayout:
    types = _types()
    prompt = build_layout_prompt(req, options, image is not None)
    contents = [types.Part.from_bytes(data=image.data, mime_type=image.mime_type), prompt] if image else [prompt]
    config = types.GenerateContentConfig(
        response_mime_type="application/json", response_json_schema=layout_schema(options), temperature=0.5,
    )
    floor_ids, wall_ids = {f.id for f in options.floor}, {w.id for w in options.wall}
    last: Exception | None = None
    for _ in range(2):  # one retry: a small model occasionally returns something unusable
        response = _call(client, model=model, contents=contents, config=config)
        try:
            data = json.loads(response.text or "")
            if not isinstance(data, dict):
                raise ValueError("not a JSON object")
            data["summary"] = str(data.get("summary") or "")[:600]
            layout = StudioLayout.model_validate({**data, "provider": "gemini"})
        except (ValueError, ValidationError) as exc:
            last = exc
            continue
        # The schema enums should already guarantee this; checked again because the model is not trusted.
        layout.floor = [p for p in layout.floor if p.type in floor_ids]
        layout.wall = [p for p in layout.wall if p.type in wall_ids]
        return layout
    raise GeminiCallError(f"Unusable layout response: {last}", "bad_output")
