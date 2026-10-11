"""Room-specific Vastu guidance, personalised to the way the room sits on the compass.

The user says which compass direction they face when they walk in through the room's main
door. For a cardinal direction that fixes the compass bearing of all four walls, so rules like
"heavy furniture on the south wall" become "the wall on your left as you enter".
These are widely quoted general Vastu guidelines, not a professional consultation.
"""
from config import DIRECTIONS
from schemas import RoomRequest

_BEARING = {d: i * 45 for i, d in enumerate(DIRECTIONS)}
_WALL_BY_REL = {0: "far wall", 90: "right-hand wall", 180: "wall with the door", 270: "left-hand wall"}
_CORNER_BY_REL = {45: "far right corner", 135: "near right corner", 225: "near left corner", 315: "far left corner"}

# Placeholders: {N} {E} {S} {W} are walls; {NE} {SE} {SW} {NW} are corners.
RULES: dict[str, list[str]] = {
    "living room": [
        "Place heavy furniture such as the main sofa and storage along the {S} or {W}.",
        "Keep the {N} and {E} walls lighter: windows, low furniture and open floor space.",
        "Keep the {NE} clean and uncluttered; avoid heavy items, shoe racks or a TV there.",
        "Put the TV and electronics in the {SE}.",
        "Seat the main members of the household facing north or east where the layout allows.",
        "Avoid a mirror that directly faces the main entrance.",
    ],
    "bedroom": [
        "Place the bed in the {SW} or along the {S} or {W}, with the headboard towards south (west is the next best).",
        "Avoid a mirror or TV that reflects or faces the bed.",
        "Put wardrobes on the {W} or {SW}, with doors that open towards north or east.",
        "Keep the {NE} light and clear; avoid storage or the bed there.",
        "Do not sleep with feet pointing directly at the door.",
    ],
    "kitchen": [
        "Place the cooking range in the {SE}, and cook facing east if possible.",
        "Keep the sink and water filter in the {NE}, away from the stove.",
        "Store grains and heavy items along the {S} or {W}.",
        "Do not place the stove directly beside the sink or the refrigerator.",
    ],
    "dining room": [
        "Place the dining table towards the {W} or {E}, keeping it square or rectangular.",
        "Seat the head of the household facing east or north.",
        "Keep the {NE} open and light.",
        "Avoid placing the table directly under a beam.",
    ],
    "home office": [
        "Put the desk towards the {W} or {SW} of the room, so you face north or east while working.",
        "Keep a solid wall behind your chair, and avoid sitting under a beam.",
        "Place storage and files on the {S} or {W}.",
        "Keep the {NE} clear for light, or a small plant.",
    ],
    "kids room": [
        "Set the study desk so the child faces east or north.",
        "Place the bed in the {SW} or along the {W}, with the head towards south or west.",
        "Keep the {NE} uncluttered and bright.",
        "Store toys and heavy items along the {S} or {W}.",
    ],
}

_PHRASE = {"N": "north", "E": "east", "S": "south", "W": "west",
           "NE": "north-east", "SE": "south-east", "SW": "south-west", "NW": "north-west"}


def _relative(direction: str, entry_direction: str | None) -> str | None:
    """Where a compass direction falls in the room, as seen walking in. None if it can't be known."""
    if entry_direction is None or _BEARING[entry_direction] % 90 != 0:
        return None  # a diagonal entry doesn't pin the walls to the cardinal directions
    rel = (_BEARING[direction] - _BEARING[entry_direction]) % 360
    return _WALL_BY_REL.get(rel) or _CORNER_BY_REL.get(rel)


def _label(key: str, entry_direction: str | None) -> str:
    direction = _PHRASE[key]
    kind = "corner" if len(key) == 2 else "wall"
    where = _relative(direction, entry_direction)
    return f"{direction} {kind} ({where})" if where else f"{direction} {kind}"


def vastu_notes(req: RoomRequest) -> list[str]:
    """Personalised notes for this room type; empty when Vastu is off."""
    if not req.vastu:
        return []
    labels = {k: _label(k, req.entry_direction) for k in _PHRASE}
    notes = [rule.format(**labels) for rule in RULES[req.room_type]]
    if req.entry_direction is None:
        notes.append("Add which way you face when you walk in to see these as left, right and far walls of your room.")
    elif _BEARING[req.entry_direction] % 90 != 0:
        notes.append("Your entry faces a diagonal, so the walls are angled to the compass. Use a phone compass to place each zone.")
    else:
        walls = ", ".join(f"{_PHRASE[k]} = {_relative(_PHRASE[k], req.entry_direction)}" for k in ("N", "E", "S", "W"))
        notes.append(f"Your room's compass layout: {walls}.")
    return notes


def describe_for_prompt(req: RoomRequest) -> str:
    """Reference rules for the AI, so it checks the photo against them instead of guessing."""
    if not req.vastu:
        return "Do not give Vastu advice."
    if req.entry_direction:
        layout = (f"The user faces {req.entry_direction} when walking in through the room's main door"
                  f" (so the far wall is the {req.entry_direction} side).")
    else:
        layout = "The room's compass orientation is NOT known; do not guess directions, and say so."
    rules = "\n".join(f"- {n}" for n in vastu_notes(req))
    return (
        f"The user wants personalised Vastu advice. {layout}\n"
        f"Vastu guidelines for a {req.room_type}, resolved to this room:\n{rules}\n"
        "In the `vastu` list, compare these guidelines with what is visible in the photo: name specific "
        "pieces you can see (bed, sofa, desk, stove) and say where they conflict with a guideline or already "
        "follow it, with a practical fix that needs no renovation. Do not invent anything you cannot see."
    )


# --- 3D designer: the same guidelines, resolved to the designer's walls and corners ---

_DESIGNER_WALLS = {0: "back wall", 90: "right wall", 180: "front wall", 270: "left wall"}
_DESIGNER_CORNERS = {45: "back-right corner", 135: "front-right corner", 225: "front-left corner", 315: "back-left corner"}


def designer_place(direction: str, compass_back: str) -> str:
    """Where a compass direction falls in the designer's room, given the side the back wall is on.

    With the back wall due north, south is the front wall; with it north-east, south is the front-right corner.
    """
    rel = (_BEARING[direction] - _BEARING[compass_back]) % 360
    return _DESIGNER_WALLS.get(rel) or _DESIGNER_CORNERS[rel]


def designer_rules(room_type: str, compass_back: str) -> list[str]:
    """This room type's Vastu guidelines with every direction named as a designer wall or corner."""
    labels = {}
    for key, direction in _PHRASE.items():
        kind = "corner" if len(key) == 2 else "side"
        labels[key] = f"{direction} {kind} (the {designer_place(direction, compass_back)})"
    return [rule.format(**labels) for rule in RULES.get(room_type, [])]


def _zone_point(rel: int, width: float, length: float) -> tuple[float, float]:
    """A spot near a designer wall or corner (1.5 ft in from the walls), in the layout's x/z feet."""
    hx, hz = max(0.0, width / 2 - 1.5), max(0.0, length / 2 - 1.5)
    return {0: (0, -hz), 45: (hx, -hz), 90: (hx, 0), 135: (hx, hz), 180: (0, hz), 225: (-hx, hz), 270: (-hx, 0), 315: (-hx, -hz)}[rel]


def designer_prompt(room_type: str, compass_back: str | None, width: float | None = None, length: float | None = None) -> str:
    """The Vastu section of the 3D layout prompt. Empty orientation: say so instead of guessing."""
    if compass_back is None:
        return ("VASTU: the user wants a Vastu-friendly layout but the room's compass orientation is unknown, "
                "so do not place anything by compass direction; mention this in the summary.")
    sides = ", ".join(f"{w} = {d}" for w, d in (
        ("back wall", compass_back),
        ("right wall", DIRECTIONS[(DIRECTIONS.index(compass_back) + 2) % 8]),
        ("front wall", DIRECTIONS[(DIRECTIONS.index(compass_back) + 4) % 8]),
        ("left wall", DIRECTIONS[(DIRECTIONS.index(compass_back) + 6) % 8]),
    ))
    rules = "\n".join(f"- {r}" for r in designer_rules(room_type, compass_back))
    zones = ""
    if width and length:
        spots = []
        for key, direction in _PHRASE.items():
            x, z = _zone_point((_BEARING[direction] - _BEARING[compass_back]) % 360, width, length)
            spots.append(f"{direction} ≈ x {x:g}, z {z:g}")
        zones = "Where each compass zone is in these coordinates: " + "; ".join(spots) + ".\n"
    return (
        "VASTU MODE: the user wants the layout to follow common Vastu guidelines. "
        f"Compass sides of this room: {sides}.\n{zones}"
        f"Guidelines for a {room_type}, already translated to this room's walls and corners:\n{rules}\n"
        "Follow these as far as the placement rules above allow (they always win: never overlap pieces or block the door). "
        "Where a piece's facing matters, choose the rotation that points it the right way. "
        "A pooja unit belongs in the north-east zone and an aquarium in the north, east or north-east; keep wardrobes, "
        "bookshelves and other tall, heavy pieces out of the north-east. "
        "In the summary, say briefly which Vastu guidelines the layout follows."
    )
