"""Gemini provider tests with a fake client: no credentials or network needed."""
import base64
import json
from types import SimpleNamespace as NS

import pytest

import main
from schemas import EditInstructions, RoomRequest
from services import gemini
from services.images import RoomImage
from services.providers import GeminiAnalyzer, GeminiImageEditor, ProviderError
from tests.conftest import APPROVED, PNG, VALID, analyze, edit

REQ = RoomRequest(**VALID)
IMAGE = RoomImage(PNG, "image/png")
EDITS = EditInstructions(**APPROVED)
EDITED_BYTES = b"\x89PNG\r\n\x1a\nEDITED"
RECS = {"summary": "Bright room with a dated sofa.", "layout": ["Float the sofa"], "keep": ["Oak floor"],
        "replace": ["Grey sofa"], "colors": ["Warm white walls"], "lighting": ["Add a floor lamp"],
        "decor": ["Linen curtains"], "budget_tips": ["Paint first"]}


class FakeClient:
    def __init__(self, *responses):
        self.calls = []
        self._responses = list(responses)
        self.models = self

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        r = self._responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


def text_response(text):
    return NS(text=text, candidates=[NS(content=NS(parts=[NS(text=text, inline_data=None)]), finish_reason="STOP")])


def image_response(data=EDITED_BYTES, mime="image/png"):
    parts = [NS(text="Here you go", inline_data=None), NS(text=None, inline_data=NS(data=data, mime_type=mime))]
    return NS(text="Here you go", candidates=[NS(content=NS(parts=parts), finish_reason="STOP")])


def sent_image(call):
    part = call["contents"][0]
    return part.inline_data.data, part.inline_data.mime_type


# --- analysis ---
def test_gemini_analysis_sends_photo_and_requests_text_only():
    client = FakeClient(text_response(json.dumps(RECS)))
    result = GeminiAnalyzer(client=client, model="analysis-model").analyze(REQ, IMAGE)
    (call,) = client.calls
    assert call["model"] == "analysis-model"
    assert sent_image(call) == (PNG, "image/png")
    assert call["config"].response_mime_type == "application/json"
    assert not call["config"].response_modalities  # never asks for an image
    assert result.method == "gemini" and result.photo_analyzed is True
    assert result.recommendations.replace == ["Grey sofa"]
    assert result.area_sqft == 168.0  # metrics still computed locally
    assert "planning this space as a living room" in call["contents"][1]


@pytest.mark.parametrize("bad", ["not json", json.dumps({"summary": 5}), ""])
def test_gemini_analysis_unusable_output_is_a_provider_error(bad):
    with pytest.raises(ProviderError):
        GeminiAnalyzer(client=FakeClient(text_response(bad)), model="m").analyze(REQ, IMAGE)


def test_gemini_sdk_errors_become_provider_errors():
    with pytest.raises(ProviderError):
        GeminiAnalyzer(client=FakeClient(TimeoutError("slow")), model="m").analyze(REQ, IMAGE)


# --- editing ---
def test_gemini_edit_sends_original_photo_with_preservation_and_approved_changes():
    client = FakeClient(image_response())
    result = GeminiImageEditor(client=client, model="image-model").edit(REQ, IMAGE, EDITS)
    (call,) = client.calls
    assert call["model"] == "image-model"
    assert sent_image(call) == (PNG, "image/png")  # the original upload is the model input
    prompt = call["contents"][1]
    for item in APPROVED["items"]:
        assert f"- {item}" in prompt
    assert APPROVED["notes"] in prompt
    assert "not a new image" in prompt and "same camera position" in prompt
    assert "doors, windows" in prompt
    assert "IMAGE" in call["config"].response_modalities
    assert result.status == "edited" and result.is_ai_generated is True
    assert result.image_url == "data:image/png;base64," + base64.b64encode(EDITED_BYTES).decode()


def test_gemini_edit_without_image_fails_honestly_and_does_not_fall_back():
    client = FakeClient(text_response("I can't edit this photo."), image_response())
    with pytest.raises(ProviderError):
        GeminiImageEditor(client=client, model="m").edit(REQ, IMAGE, EDITS)
    assert len(client.calls) == 1  # no second, text-to-image attempt


def test_gemini_edit_ignores_non_image_inline_data():
    client = FakeClient(image_response(data=b"%PDF", mime="application/pdf"))
    with pytest.raises(ProviderError):
        GeminiImageEditor(client=client, model="m").edit(REQ, IMAGE, EDITS)


def test_prompt_only_lists_approved_changes():
    prompt = gemini.build_edit_prompt(REQ, EditInstructions(items=["Add a plant"]))
    assert "- Add a plant" in prompt and "sofa" not in prompt


# --- through the API ---
def test_api_returns_the_actual_edited_image(client, monkeypatch):
    fake = FakeClient(image_response())
    monkeypatch.setattr(main, "get_design_editor", lambda: GeminiImageEditor(client=fake, model="m"))
    data = edit(client).json()
    assert data["status"] == "edited"
    assert base64.b64decode(data["image_url"].split(",", 1)[1]) == EDITED_BYTES
    assert sent_image(fake.calls[0])[0] == PNG


def test_api_gemini_edit_failure_returns_502_without_image(client, monkeypatch):
    fake = FakeClient(text_response("blocked"))
    monkeypatch.setattr(main, "get_design_editor", lambda: GeminiImageEditor(client=fake, model="m"))
    r = edit(client)
    assert r.status_code == 502 and "data:image" not in r.text


def test_api_gemini_analysis_does_not_touch_image_model(client, monkeypatch):
    analysis_client = FakeClient(text_response(json.dumps(RECS)))
    image_client = FakeClient()
    monkeypatch.setattr(main, "get_room_analyzer", lambda: GeminiAnalyzer(client=analysis_client, model="text"))
    monkeypatch.setattr(main, "get_design_editor", lambda: GeminiImageEditor(client=image_client, model="img"))
    r = analyze(client)
    assert r.status_code == 200 and r.json()["photo_analyzed"] is True
    assert len(analysis_client.calls) == 1 and image_client.calls == []


# --- failure classification ---
class FakeAPIError(Exception):
    def __init__(self, code):
        super().__init__(f"HTTP {code}")
        self.code = code


@pytest.mark.parametrize("code, status, text", [
    (429, 429, "usage limit"),
    (401, 502, "credentials"),
    (504, 504, "too long"),
    (500, 502, "did not return an edited photo"),
])
def test_edit_failures_are_classified_without_leaking_details(client, monkeypatch, code, status, text):
    fake = FakeClient(FakeAPIError(code))
    monkeypatch.setattr(main, "get_design_editor", lambda: GeminiImageEditor(client=fake, model="m"))
    r = edit(client)
    assert r.status_code == status and r.json()["error"] == "edit_failed"
    assert text in r.text and "original photo is unchanged" in r.text
    assert "data:image" not in r.text and f"HTTP {code}" not in r.text


def test_analysis_quota_error_is_reported_as_429(client, monkeypatch):
    fake = FakeClient(FakeAPIError(429))
    monkeypatch.setattr(main, "get_room_analyzer", lambda: GeminiAnalyzer(client=fake, model="m"))
    r = analyze(client)
    assert r.status_code == 429 and r.json()["error"] == "analysis_failed"
