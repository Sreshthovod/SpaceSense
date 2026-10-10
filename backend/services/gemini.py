"""Gemini calls. Analysis (text out) and photo editing (image out) are deliberately separate.

The client is passed in, so tests use fakes and never need credentials or network access.
"""
import base64
import json
import logging

from pydantic import ValidationError

from schemas import ChatRequest, DesignRecommendations, EditInstructions, RoomRequest
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
