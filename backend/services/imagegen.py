"""Image generation and editing through Cloudflare Workers AI (REST).

Two providers, chosen per request: "cloudflare" (below) or "gemini" (the same client and image model the
photo redesign uses). Credentials come from CF_ACCOUNT_ID / CF_API_TOKEN / GEMINI_API_KEY in backend/.env
only. They never reach the frontend, and error messages built here never contain them.

  text -> image   @cf/black-forest-labs/flux-1-schnell   JSON body {prompt, steps}
  image -> image  @cf/black-forest-labs/flux-2-klein-4b  multipart body (prompt, width, height, input_image_0)
"""
import base64
import binascii
import json
import logging
import os
import re
import secrets
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from dataclasses import dataclass

import cv2
import numpy as np

from services.images import sniff_mime

logger = logging.getLogger("spacesense.imagegen")

API_ROOT = "https://api.cloudflare.com/client/v4/accounts"
TEXT_MODEL = "@cf/black-forest-labs/flux-1-schnell"
EDIT_MODEL = "@cf/black-forest-labs/flux-2-klein-4b"

PROMPT_MAX = 2048
STEPS_RANGE = (1, 8)
DEFAULT_STEPS = 4
MAX_EDIT_UPLOAD_BYTES = 5 * 1024 * 1024
# flux-2-klein-4b only accepts reference images smaller than 512x512, and 256-1920 px outputs.
EDIT_INPUT_MAX_SIDE = 480
EDIT_OUTPUT_RANGE = (256, 1920)
EDIT_MIMES = ("image/png", "image/jpeg", "image/webp")
PROVIDERS = ("cloudflare", "gemini")
DEFAULT_PROVIDER = "cloudflare"

DEFAULT_TIMEOUT_S = 60.0
DEFAULT_RATE_PER_MIN = 5

_ACCOUNT_ID = re.compile(r"^[A-Za-z0-9]{8,64}$")


class ImageGenError(Exception):
    """Cloudflare failed. The message is for logs only; `reason` picks the user-facing message."""

    def __init__(self, message: str, reason: str = "unavailable"):
        super().__init__(message)
        self.reason = reason


class ImageGenValidationError(Exception):
    def __init__(self, message: str, field: str = "body", too_large: bool = False):
        super().__init__(message)
        self.field = field
        self.too_large = too_large


# ---- validation -------------------------------------------------------------------------------

def validate_prompt(prompt) -> str:
    if not isinstance(prompt, str) or not prompt.strip():
        raise ImageGenValidationError("A prompt is required.", "prompt")
    prompt = prompt.strip()
    if len(prompt) > PROMPT_MAX:
        raise ImageGenValidationError(f"The prompt must be {PROMPT_MAX} characters or fewer.", "prompt")
    return prompt


def validate_steps(steps) -> int:
    if steps is None:
        return DEFAULT_STEPS
    if isinstance(steps, bool) or not isinstance(steps, int):
        raise ImageGenValidationError("Steps must be a whole number.", "steps")
    if not STEPS_RANGE[0] <= steps <= STEPS_RANGE[1]:
        raise ImageGenValidationError(f"Steps must be between {STEPS_RANGE[0]} and {STEPS_RANGE[1]}.", "steps")
    return steps


def validate_provider(provider) -> str:
    if provider is None or provider == "":
        return DEFAULT_PROVIDER
    if provider not in PROVIDERS:
        raise ImageGenValidationError(f"Provider must be one of: {', '.join(PROVIDERS)}.", "provider")
    return provider


def provider_status() -> dict[str, bool]:
    """Which providers have credentials. Says nothing about whether the credentials are valid."""
    return {
        "cloudflare": bool(os.getenv("CF_ACCOUNT_ID", "").strip() and os.getenv("CF_API_TOKEN", "").strip()),
        "gemini": bool(os.getenv("GEMINI_API_KEY", "").strip()),
    }


def validate_upload(data: bytes) -> str:
    """Check size and real content type of an uploaded image; returns its mime type."""
    if not data:
        raise ImageGenValidationError("The image is empty.", "image")
    if len(data) > MAX_EDIT_UPLOAD_BYTES:
        raise ImageGenValidationError(
            f"The image must be {MAX_EDIT_UPLOAD_BYTES // (1024 * 1024)} MB or smaller.", "image", too_large=True
        )
    mime = sniff_mime(data)
    if mime not in EDIT_MIMES:
        raise ImageGenValidationError("The image must be a PNG, JPEG or WebP file.", "image")
    return mime


@dataclass(frozen=True)
class EditInput:
    data: bytes  # PNG, already shrunk to what the model accepts
    width: int
    height: int


def prepare_edit_image(data: bytes) -> EditInput:
    """Check an upload and shrink it to what the Cloudflare edit model accepts."""
    validate_upload(data)
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ImageGenValidationError("The image could not be read.", "image")
    h, w = img.shape[:2]
    scale = min(1.0, EDIT_INPUT_MAX_SIDE / max(h, w))
    if scale < 1.0:
        img = cv2.resize(img, (max(1, round(w * scale)), max(1, round(h * scale))), interpolation=cv2.INTER_AREA)
        h, w = img.shape[:2]
    ok, png = cv2.imencode(".png", img)
    if not ok:
        raise ImageGenValidationError("The image could not be processed.", "image")
    lo, hi = EDIT_OUTPUT_RANGE
    # Output matches the reference's shape, on a 16 px grid within the model's range.
    snap = lambda v: min(hi, max(lo, round(v / 16) * 16))
    return EditInput(data=png.tobytes(), width=snap(w), height=snap(h))


# ---- rate limiting ----------------------------------------------------------------------------

class RateLimiter:
    """Sliding window per client, in memory. Enough for one server process."""

    def __init__(self, limit: int, window_s: float = 60.0, max_clients: int = 10_000):
        self.limit, self.window_s, self.max_clients = limit, window_s, max_clients
        self._hits: dict[str, deque] = {}
        self._lock = threading.Lock()

    def check(self, client: str, now: float | None = None) -> float:
        """Record a request and return 0, or the seconds to wait if the client is over the limit."""
        now = time.monotonic() if now is None else now
        with self._lock:
            hits = self._hits.setdefault(client, deque())
            while hits and now - hits[0] >= self.window_s:
                hits.popleft()
            if len(hits) >= self.limit:
                return max(1.0, self.window_s - (now - hits[0]))
            hits.append(now)
            if len(self._hits) > self.max_clients:  # drop idle clients so memory stays bounded
                for key in [k for k, v in self._hits.items() if not v or now - v[-1] >= self.window_s]:
                    del self._hits[key]
            return 0.0


_limiter: RateLimiter | None = None
_limiter_lock = threading.Lock()


def get_rate_limiter() -> RateLimiter:
    global _limiter
    with _limiter_lock:
        if _limiter is None:
            limit = int(os.getenv("SPACESENSE_IMAGEGEN_RATE_PER_MIN", DEFAULT_RATE_PER_MIN))
            _limiter = RateLimiter(limit=max(1, limit))
        return _limiter


def reset_rate_limiter() -> None:
    global _limiter
    with _limiter_lock:
        _limiter = None


# ---- Cloudflare calls -------------------------------------------------------------------------

def _credentials() -> tuple[str, str]:
    account = os.getenv("CF_ACCOUNT_ID", "").strip()
    token = os.getenv("CF_API_TOKEN", "").strip()
    if not account or not token:
        raise ImageGenError("CF_ACCOUNT_ID or CF_API_TOKEN is not set", "not_configured")
    if not _ACCOUNT_ID.match(account):
        raise ImageGenError("CF_ACCOUNT_ID is not a valid account id", "not_configured")
    return account, token


def _classify(status: int, errors: list) -> str:
    text = " ".join(str(e.get("message", "")) for e in errors if isinstance(e, dict)).lower()
    codes = {e.get("code") for e in errors if isinstance(e, dict)}
    if status == 429 or 4006 in codes or "neurons" in text or "daily" in text or "quota" in text or "rate limit" in text:
        return "quota"
    if status in (401, 403) or 10000 in codes or "authentication" in text:
        return "auth"
    if status in (400, 422):
        return "rejected"
    return "unavailable"


def _post(model: str, body: bytes, content_type: str) -> bytes:
    account, token = _credentials()
    url = f"{API_ROOT}/{urllib.parse.quote(account)}/ai/run/{model}"
    req = urllib.request.Request(
        url, data=body, method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": content_type, "Accept": "application/json"},
    )
    timeout = float(os.getenv("SPACESENSE_IMAGEGEN_TIMEOUT_S", DEFAULT_TIMEOUT_S))
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.read(32 * 1024 * 1024)
    except urllib.error.HTTPError as exc:
        try:
            errors = json.loads(exc.read(64 * 1024) or b"{}").get("errors") or []
        except (ValueError, AttributeError):
            errors = []
        reason = _classify(exc.code, errors)
        # Log Cloudflare's own error text, never the request (which carries the token).
        logger.error("Cloudflare %s returned HTTP %s: %s", model, exc.code, errors)
        raise ImageGenError(f"HTTP {exc.code}", reason) from None
    except TimeoutError:
        raise ImageGenError("timed out", "timeout") from None
    except urllib.error.URLError as exc:
        if isinstance(exc.reason, TimeoutError):
            raise ImageGenError("timed out", "timeout") from None
        raise ImageGenError(f"network error: {type(exc.reason).__name__}", "unavailable") from None
    except OSError as exc:
        raise ImageGenError(f"network error: {type(exc).__name__}", "unavailable") from None


def _image_from_response(raw: bytes) -> str:
    """Pull the base64 image out of Cloudflare's {success, result: {image}} envelope as a data URL."""
    try:
        data = json.loads(raw)
    except ValueError:
        raise ImageGenError("response was not JSON", "unavailable") from None
    if not isinstance(data, dict):
        raise ImageGenError("unexpected response shape", "unavailable")
    if data.get("success") is False:
        errors = data.get("errors") or []
        logger.error("Cloudflare reported failure: %s", errors)
        raise ImageGenError("success=false", _classify(200, errors))
    result = data.get("result")
    b64 = result.get("image") if isinstance(result, dict) else None
    if not isinstance(b64, str) or not b64:
        raise ImageGenError("no image in response", "unavailable")
    try:
        mime = sniff_mime(base64.b64decode(b64[:64] + "=" * (-len(b64[:64]) % 4), validate=True)) or "image/jpeg"
    except (binascii.Error, ValueError):
        raise ImageGenError("image was not valid base64", "unavailable") from None
    return f"data:{mime};base64,{b64}"


def generate_image(prompt: str, steps: int = DEFAULT_STEPS) -> str:
    body = json.dumps({"prompt": prompt, "steps": steps}).encode()
    return _image_from_response(_post(TEXT_MODEL, body, "application/json"))


def _multipart(fields: dict[str, str], files: dict[str, tuple[str, str, bytes]]) -> tuple[bytes, str]:
    boundary = "spacesense" + secrets.token_hex(16)
    parts: list[bytes] = []
    for name, value in fields.items():
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
        )
    for name, (filename, mime, data) in files.items():
        head = (
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
            f"Content-Type: {mime}\r\n\r\n"
        )
        parts.append(head.encode() + data + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def edit_image(prompt: str, source: EditInput) -> str:
    body, content_type = _multipart(
        {"prompt": prompt, "width": str(source.width), "height": str(source.height)},
        {"input_image_0": ("input.png", "image/png", source.data)},
    )
    return _image_from_response(_post(EDIT_MODEL, body, content_type))


# ---- Gemini -----------------------------------------------------------------------------------

_GEMINI_REASONS = {"quota": "quota", "auth": "auth", "timeout": "timeout", "no_image": "rejected"}


def gemini_generate(prompt: str, data: bytes | None = None, mime: str | None = None) -> str:
    """Text to image, or (with `data`) generate on top of an uploaded image. Returns a data URL."""
    from services import gemini
    from services.providers import DEFAULT_GEMINI_IMAGE_MODEL, ProviderConfigError, _gemini_client

    try:
        client = _gemini_client()
    except ProviderConfigError as exc:
        raise ImageGenError(str(exc), "not_configured") from None
    types = gemini._types()
    model = os.getenv("SPACESENSE_GEMINI_IMAGE_MODEL", DEFAULT_GEMINI_IMAGE_MODEL)
    contents = [types.Part.from_bytes(data=data, mime_type=mime), prompt] if data else [prompt]
    try:
        response = gemini._call(
            client, model=model, contents=contents,
            config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"]),
        )
    except gemini.GeminiCallError as exc:
        raise ImageGenError(f"Gemini: {exc}", _GEMINI_REASONS.get(exc.reason, "unavailable")) from None
    found = gemini._first_image(response)
    if found is None:
        raise ImageGenError("Gemini returned no image", "rejected")
    image, image_mime = found
    return f"data:{image_mime};base64,{base64.b64encode(image).decode('ascii')}"
