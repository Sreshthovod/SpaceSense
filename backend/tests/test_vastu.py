import pytest
from pydantic import ValidationError

from schemas import RoomRequest
from services import vastu
from services.gemini import build_analysis_prompt

BASE = {"room_type": "bedroom", "length_ft": 12, "width_ft": 11, "height_ft": 9,
        "style": "minimalist", "budget_inr": 50000, "vastu": True}


def req(**kw) -> RoomRequest:
    return RoomRequest(**{**BASE, **kw})


def test_off_means_no_notes():
    assert vastu.vastu_notes(req(vastu=False, entry_direction="north")) == []


def test_rules_differ_by_room_type():
    assert vastu.vastu_notes(req(room_type="bedroom")) != vastu.vastu_notes(req(room_type="kitchen"))
    kitchen = " ".join(vastu.vastu_notes(req(room_type="kitchen")))
    assert "cooking range" in kitchen and "south-east corner" in kitchen


def test_entry_direction_maps_compass_to_walls():
    # Walking in facing north: far wall is north, so south is the wall with the door,
    # west is on the left and east is on the right.
    text = " ".join(vastu.vastu_notes(req(room_type="living room", entry_direction="north")))
    assert "south wall (wall with the door)" in text
    assert "west wall (left-hand wall)" in text
    assert "north-east corner (far right corner)" in text


def test_different_entry_gives_different_advice():
    north = vastu.vastu_notes(req(entry_direction="north"))
    east = vastu.vastu_notes(req(entry_direction="east"))
    assert north != east
    # Facing east on entry: west is the wall with the door, north is on the left.
    living = " ".join(vastu.vastu_notes(req(room_type="living room", entry_direction="east")))
    assert "west wall (wall with the door)" in living and "north wall (left-hand wall)" in living


def test_unknown_entry_does_not_invent_positions():
    notes = vastu.vastu_notes(req(room_type="living room"))
    assert not any("(" in n for n in notes)  # no "(left-hand wall)" style placement
    assert any("walk in" in n for n in notes)


def test_diagonal_entry_falls_back_to_compass_only():
    notes = vastu.vastu_notes(req(room_type="living room", entry_direction="north-east"))
    assert not any("left-hand" in n for n in notes)
    assert any("diagonal" in n for n in notes)


def test_entry_direction_validation():
    assert req(entry_direction=" North-East ").entry_direction == "north-east"
    assert req(entry_direction="").entry_direction is None
    with pytest.raises(ValidationError):
        req(entry_direction="upwards")


def test_gemini_prompt_carries_resolved_rules_and_photo_instruction():
    prompt = build_analysis_prompt(req(room_type="bedroom", entry_direction="south"), {"area_sqft": 132},)
    assert "faces south when walking in" in prompt
    assert "compare these guidelines with what is visible in the photo" in prompt
    assert "- vastu:" in prompt


def test_prompt_without_vastu_asks_for_none():
    assert "Do not give Vastu advice" in build_analysis_prompt(req(vastu=False), {"area_sqft": 132})
