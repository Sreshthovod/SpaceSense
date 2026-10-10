"""Pluggable providers for room analysis and photo editing.

Routes depend only on the two interfaces below. Analysis providers return text and never
touch an image model; editing providers receive the user's original photo and the changes
the user approved. Providers are chosen with SPACESENSE_ANALYSIS_PROVIDER and
SPACESENSE_DESIGN_PROVIDER. Credentials come from backend environment variables only.
"""
import logging
import os
from functools import lru_cache
from typing import Protocol

from schemas import ChatReply, ChatRequest, DesignResponse, EditInstructions, LayoutOptions, RoomAnalysis, RoomRequest, StudioLayout
from services import gemini, vision
from services.analysis import analyze_room, room_metrics
from services.images import RoomImage

logger = logging.getLogger("spacesense.providers")

DEFAULT_GEMINI_ANALYSIS_MODEL = "gemini-3.5-flash-lite"  # fast enough for interactive use
DEFAULT_GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image"


class ProviderError(Exception):
    """A provider failed. The message is for logs only; `reason` picks the user-facing message."""

    def __init__(self, message: str, reason: str = "unavailable"):
        super().__init__(message)
        self.reason = reason


class ProviderConfigError(Exception):
    """The configured provider name is unknown or missing required settings."""


class RoomAnalyzer(Protocol):
    name: str

    def analyze(self, req: RoomRequest, image: RoomImage) -> RoomAnalysis: ...


class RoomChat(Protocol):
    name: str

    def reply(self, req: RoomRequest, image: RoomImage, chat: ChatRequest) -> ChatReply: ...


class DesignEditor(Protocol):
    name: str

    def edit(self, req: RoomRequest, image: RoomImage, instructions: EditInstructions) -> DesignResponse: ...


class RuleBasedAnalyzer:
    name = "rule_based"

    def analyze(self, req: RoomRequest, image: RoomImage) -> RoomAnalysis:
        return analyze_room(req)


class OfflineChat:
    """Used when no AI provider is configured. Says so instead of pretending to answer."""

    name = "offline"

    def reply(self, req: RoomRequest, image: RoomImage, chat: ChatRequest) -> ChatReply:
        return ChatReply(
            reply="The AI consultant isn't switched on for this server, so I can't answer questions yet. "
            "Your recommendations above still apply. To enable chat, set SPACESENSE_ANALYSIS_PROVIDER=gemini "
            "and GEMINI_API_KEY on the backend.",
            provider=self.name,
            is_ai_generated=False,
        )


class MockDesignEditor:
    """Never produces an image; the response says so explicitly."""

    name = "mock"

    def edit(self, req: RoomRequest, image: RoomImage, instructions: EditInstructions) -> DesignResponse:
        return DesignResponse(
            status="mock",
            provider=self.name,
            is_ai_generated=False,
            image_url=None,
            message="Image editing is not configured (mock provider), so no edited photo was created. "
            "Your original photo is unchanged.",
            instructions_used=instructions.items,
        )


def _gemini_client():
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        raise ProviderConfigError("GEMINI_API_KEY is not set")
    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise ProviderConfigError("google-genai is not installed; run pip install -r requirements.txt") from exc
    timeout_ms = int(float(os.getenv("SPACESENSE_GEMINI_TIMEOUT_S", "90")) * 1000)
    return genai.Client(api_key=key, http_options=types.HttpOptions(timeout=timeout_ms))


class GeminiAnalyzer:
    name = "gemini"

    def __init__(self, client=None, model: str | None = None):
        self.client = client or _gemini_client()
        self.model = model or os.getenv("SPACESENSE_GEMINI_ANALYSIS_MODEL", DEFAULT_GEMINI_ANALYSIS_MODEL)

    def analyze(self, req: RoomRequest, image: RoomImage) -> RoomAnalysis:
        metrics = room_metrics(req)
        try:
            recs = gemini.analyze_with_gemini(
                self.client, self.model, req, image, metrics, vision.describe_for_prompt(vision.assess_photo(image))
            )
        except gemini.GeminiCallError as exc:
            raise ProviderError(f"Gemini analysis failed: {exc}", exc.reason) from exc
        if recs.vastu and req.vastu:
            metrics = {**metrics, "vastu_notes": recs.vastu}  # photo-specific notes replace the generic rule list
        return RoomAnalysis(
            method="gemini",
            photo_analyzed=True,
            recommendations=recs,
            disclaimer="AI-generated advice from your photo and inputs. Check measurements before buying.",
            **metrics,
        )


class GeminiChat:
    name = "gemini"

    def __init__(self, client=None, model: str | None = None):
        self.client = client or _gemini_client()
        self.model = model or os.getenv("SPACESENSE_GEMINI_ANALYSIS_MODEL", DEFAULT_GEMINI_ANALYSIS_MODEL)

    def reply(self, req: RoomRequest, image: RoomImage, chat: ChatRequest) -> ChatReply:
        try:
            text = gemini.chat_with_gemini(self.client, self.model, req, image, room_metrics(req), chat)
        except gemini.GeminiCallError as exc:
            raise ProviderError(f"Gemini chat failed: {exc}", exc.reason) from exc
        return ChatReply(reply=text, provider=self.name, is_ai_generated=True)


class GeminiLayout:
    """Proposes where designer pieces go. Text out only, so it works on the free Gemini tier."""

    name = "gemini"

    def __init__(self, client=None, model: str | None = None):
        self.client = client or _gemini_client()
        self.model = (
            model
            or os.getenv("SPACESENSE_GEMINI_LAYOUT_MODEL")
            or os.getenv("SPACESENSE_GEMINI_ANALYSIS_MODEL", DEFAULT_GEMINI_ANALYSIS_MODEL)
        )

    def arrange(self, req: RoomRequest, image: RoomImage | None, options: LayoutOptions) -> StudioLayout:
        try:
            return gemini.layout_with_gemini(self.client, self.model, req, image, options)
        except gemini.GeminiCallError as exc:
            raise ProviderError(f"Gemini layout failed: {exc}", exc.reason) from exc


class GeminiImageEditor:
    name = "gemini"

    def __init__(self, client=None, model: str | None = None):
        self.client = client or _gemini_client()
        self.model = model or os.getenv("SPACESENSE_GEMINI_IMAGE_MODEL", DEFAULT_GEMINI_IMAGE_MODEL)

    def edit(self, req: RoomRequest, image: RoomImage, instructions: EditInstructions) -> DesignResponse:
        try:
            image_url = gemini.edit_with_gemini(self.client, self.model, req, image, instructions)
        except gemini.GeminiCallError as exc:
            raise ProviderError(f"Gemini image edit failed: {exc}", exc.reason) from exc
        return DesignResponse(
            status="edited",
            provider=self.name,
            is_ai_generated=True,
            image_url=image_url,
            message="AI-edited version of your original photo. Edits can contain visual inaccuracies.",
            instructions_used=instructions.items,
        )


ANALYZERS: dict[str, type] = {"rule_based": RuleBasedAnalyzer, "gemini": GeminiAnalyzer}
EDITORS: dict[str, type] = {"mock": MockDesignEditor, "gemini": GeminiImageEditor}
# Chat follows the analysis provider: AI analysis means AI chat; rule-based means the offline notice.
CHATS: dict[str, type] = {"rule_based": OfflineChat, "gemini": GeminiChat}


def _select(registry: dict[str, type], env_var: str, default: str):
    name = os.getenv(env_var, default).strip().lower()
    if name not in registry:
        raise ProviderConfigError(f"{env_var}={name!r} is not one of: {', '.join(registry)}")
    return registry[name]()


@lru_cache
def get_room_analyzer() -> RoomAnalyzer:
    return _select(ANALYZERS, "SPACESENSE_ANALYSIS_PROVIDER", "rule_based")


@lru_cache
def get_design_editor() -> DesignEditor:
    return _select(EDITORS, "SPACESENSE_DESIGN_PROVIDER", "mock")


@lru_cache
def get_room_chat() -> RoomChat:
    return _select(CHATS, "SPACESENSE_ANALYSIS_PROVIDER", "rule_based")
