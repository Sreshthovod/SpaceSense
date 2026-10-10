"""Validation for uploaded room photos. The content is checked, not just the declared type."""
import os
from dataclasses import dataclass

DEFAULT_MAX_UPLOAD_MB = 10


class ImageValidationError(Exception):
    def __init__(self, message: str, too_large: bool = False):
        super().__init__(message)
        self.too_large = too_large


@dataclass(frozen=True)
class RoomImage:
    data: bytes
    mime_type: str


def max_upload_bytes() -> int:
    return int(float(os.getenv("SPACESENSE_MAX_UPLOAD_MB", DEFAULT_MAX_UPLOAD_MB)) * 1024 * 1024)


def sniff_mime(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def validate_image(data: bytes) -> RoomImage:
    if not data:
        raise ImageValidationError("The photo is empty.")
    limit = max_upload_bytes()
    if len(data) > limit:
        raise ImageValidationError(f"The photo must be {limit // (1024 * 1024)} MB or smaller.", too_large=True)
    mime = sniff_mime(data)
    if mime is None:
        raise ImageValidationError("The photo must be a JPG, PNG or WebP image.")
    return RoomImage(data=data, mime_type=mime)
