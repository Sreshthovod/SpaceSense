"""Deterministic photo checks with OpenCV. No AI model, no network, no credentials.

Three jobs: judge whether a photo is good enough to analyse, measure its colours and light,
and check that an AI-edited photo still has the same room structure as the original.
Every function degrades to None instead of raising, so a vision problem never fails a request.
"""
import base64
import logging

import cv2
import numpy as np

from schemas import PhotoInsights, PreservationCheck
from services.images import RoomImage

logger = logging.getLogger("spacesense.vision")

MIN_SIDE_PX = 480
BLUR_THRESHOLD = 60.0  # variance of the Laplacian on a 640px-wide grayscale copy
DARK_MEAN = 70
BRIGHT_MEAN = 200
CLIPPED_SHARE = 0.25  # share of pixels crushed to black or blown to white
PRESERVED_SCORE = 0.55  # structure similarity at or above this counts as the same room
ANALYSIS_WIDTH = 640
COMPARE_SIZE = (256, 192)


def _decode(data: bytes) -> np.ndarray | None:
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img if img is not None and img.size else None


def _resize_to_width(img: np.ndarray, width: int) -> np.ndarray:
    h, w = img.shape[:2]
    if w <= width:
        return img
    return cv2.resize(img, (width, max(1, round(h * width / w))), interpolation=cv2.INTER_AREA)


def _dominant_colors(img: np.ndarray, k: int = 4) -> list[str]:
    """Most common colours (hex), by k-means on a small copy. Ordered from most to least common."""
    small = cv2.resize(img, (64, 48), interpolation=cv2.INTER_AREA).reshape(-1, 3).astype(np.float32)
    k = min(k, len(np.unique(small, axis=0)))
    if k < 1:
        return []
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, labels, centers = cv2.kmeans(small, k, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
    order = np.argsort(-np.bincount(labels.flatten(), minlength=k))
    return [f"#{int(c[2]):02x}{int(c[1]):02x}{int(c[0]):02x}" for c in centers[order]]


def assess_photo(image: RoomImage) -> PhotoInsights | None:
    """Quality warnings plus measured colours and light. None if the image can't be decoded."""
    try:
        img = _decode(image.data)
        if img is None:
            return None
        h, w = img.shape[:2]
        small = _resize_to_width(img, ANALYSIS_WIDTH)
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

        sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        mean = float(gray.mean())
        dark_share = float((gray < 25).mean())
        bright_share = float((gray > 245).mean())

        issues: list[str] = []
        if min(h, w) < MIN_SIDE_PX:
            issues.append(f"Low resolution ({w}×{h}px). A larger photo gives better results.")
        if sharpness < BLUR_THRESHOLD:
            issues.append("The photo looks blurry. Retake it holding the camera steady.")
        if mean < DARK_MEAN or dark_share > CLIPPED_SHARE:
            issues.append("The photo is quite dark. Turn on lights or open curtains and retake it.")
        if mean > BRIGHT_MEAN or bright_share > CLIPPED_SHARE:
            issues.append("The photo is overexposed. Avoid shooting straight into a bright window.")

        brightness = "dark" if mean < DARK_MEAN else "bright" if mean > BRIGHT_MEAN else "balanced"
        hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
        return PhotoInsights(
            width=w,
            height=h,
            sharpness=round(sharpness, 1),
            brightness=brightness,
            brightness_level=round(mean / 255, 2),
            average_saturation=round(float(hsv[..., 1].mean()) / 255, 2),
            dominant_colors=_dominant_colors(small),
            usable=not any("blurry" in i or "dark" in i for i in issues),
            issues=issues,
        )
    except Exception:  # noqa: BLE001 - vision must never break the request
        logger.exception("Photo assessment failed")
        return None


def describe_for_prompt(insights: PhotoInsights | None) -> str:
    """Measured facts for the analysis prompt. Empty if nothing was measured."""
    if insights is None:
        return ""
    lines = [
        f"Photo size {insights.width}x{insights.height}px; overall lighting is {insights.brightness}.",
        f"Dominant colours in the photo (hex, most common first): {', '.join(insights.dominant_colors)}.",
    ]
    if insights.issues:
        lines.append("Photo quality problems: " + " ".join(insights.issues))
    return "Measured from the photo with image processing (treat as reliable facts):\n" + "\n".join(lines)


def _structure(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(cv2.resize(img, COMPARE_SIZE, interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 50, 150)
    # Blur the edge map so small shifts in furniture don't count as structural change.
    return cv2.GaussianBlur(edges.astype(np.float32), (15, 15), 0)


def compare_structure(original: RoomImage, edited_data_url: str) -> PreservationCheck | None:
    """How closely the edited photo keeps the original's layout of walls, windows and lines."""
    try:
        header, _, payload = edited_data_url.partition(",")
        if not header.startswith("data:image/") or not payload:
            return None
        before = _decode(original.data)
        after = _decode(base64.b64decode(payload))
        if before is None or after is None:
            return None
        a, b = _structure(before).ravel(), _structure(after).ravel()
        a, b = a - a.mean(), b - b.mean()
        denom = float(np.linalg.norm(a) * np.linalg.norm(b))
        score = max(0.0, float(a @ b) / denom) if denom else 0.0
        preserved = score >= PRESERVED_SCORE
        return PreservationCheck(
            score=round(score, 2),
            preserved=preserved,
            note=(
                "The edited photo keeps the original room's structure."
                if preserved
                else "The edit may have changed the room's structure (walls, windows or camera angle). "
                "Compare it with your original before relying on it."
            ),
        )
    except Exception:  # noqa: BLE001
        logger.exception("Structure comparison failed")
        return None
