import base64

import cv2
import numpy as np

from services import vision
from services.images import RoomImage


def png(img) -> RoomImage:
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return RoomImage(data=buf.tobytes(), mime_type="image/png")


def data_url(img) -> str:
    return "data:image/png;base64," + base64.b64encode(png(img).data).decode()


def room(seed=0, w=800, h=600):
    """A synthetic 'room': light wall, darker floor, a window frame and a sofa block, plus fine texture."""
    rng = np.random.default_rng(seed)
    img = np.full((h, w, 3), (205, 215, 225), np.uint8)
    img[int(h * 0.7):] = (90, 110, 140)
    cv2.rectangle(img, (int(w * .1), int(h * .1)), (int(w * .35), int(h * .45)), (250, 250, 250), 6)
    cv2.rectangle(img, (int(w * .4), int(h * .5)), (int(w * .85), int(h * .8)), (60, 90, 50), -1)
    noise = rng.integers(-12, 12, img.shape, dtype=np.int16)
    return np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)


def test_good_photo_has_no_issues_and_measured_colours():
    info = vision.assess_photo(png(room()))
    assert info is not None
    assert info.usable and info.issues == []
    assert info.brightness == "balanced"
    assert 1 <= len(info.dominant_colors) <= 4
    assert all(c.startswith("#") and len(c) == 7 for c in info.dominant_colors)


def test_blurry_photo_is_flagged():
    blurred = cv2.GaussianBlur(room(), (0, 0), 12)
    info = vision.assess_photo(png(blurred))
    assert not info.usable
    assert any("blurry" in i for i in info.issues)


def test_dark_photo_is_flagged():
    dark = (room() * 0.12).astype(np.uint8)
    info = vision.assess_photo(png(dark))
    assert info.brightness == "dark"
    assert any("dark" in i for i in info.issues)


def test_low_resolution_is_flagged_but_does_not_fail():
    info = vision.assess_photo(png(room(w=200, h=150)))
    assert any("Low resolution" in i for i in info.issues)


def test_undecodable_data_returns_none():
    assert vision.assess_photo(RoomImage(data=b"not an image", mime_type="image/png")) is None


def test_prompt_facts_include_colours_and_lighting():
    text = vision.describe_for_prompt(vision.assess_photo(png(room())))
    assert "Dominant colours" in text and "lighting is balanced" in text
    assert vision.describe_for_prompt(None) == ""


def test_edit_with_same_structure_is_preserved():
    original = room()
    recoloured = original.copy()
    recoloured[..., 2] = np.clip(recoloured[..., 2].astype(int) + 30, 0, 255).astype(np.uint8)
    check = vision.compare_structure(png(original), data_url(recoloured))
    assert check.preserved and check.score > vision.PRESERVED_SCORE


def test_unrelated_image_is_not_preserved():
    other = np.zeros((600, 800, 3), np.uint8)
    for x in range(0, 800, 40):
        cv2.line(other, (x, 0), (800 - x, 600), (255, 255, 255), 3)
    check = vision.compare_structure(png(room()), data_url(other))
    assert not check.preserved


def test_compare_rejects_bad_input_without_raising():
    assert vision.compare_structure(png(room()), "not-a-data-url") is None
    assert vision.compare_structure(png(room()), "data:image/png;base64,@@@") is None
