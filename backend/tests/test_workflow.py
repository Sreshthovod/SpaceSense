"""Consult-first workflow: analysis never edits; editing needs approval and uses the original photo."""
import json

import pytest

import main
from schemas import DesignResponse
from services.providers import MockDesignEditor, ProviderError
from tests.conftest import APPROVED, PNG, VALID, analyze, edit

EDITED_URL = "data:image/png;base64,ZWRpdGVk"


class RecordingEditor:
    name = "recording"

    def __init__(self, fail=False):
        self.calls = []
        self.fail = fail

    def edit(self, req, image, instructions):
        self.calls.append((req, image, instructions))
        if self.fail:
            raise ProviderError("model returned text only")
        return DesignResponse(status="edited", provider=self.name, is_ai_generated=True, image_url=EDITED_URL,
                              message="edited", instructions_used=instructions.items)


@pytest.fixture
def editor(monkeypatch):
    rec = RecordingEditor()
    monkeypatch.setattr(main, "get_design_editor", lambda: rec)
    return rec


# --- analysis never edits ---
def test_analysis_returns_recommendations_without_invoking_editor(client, editor):
    r = analyze(client)
    assert r.status_code == 200
    assert r.json()["recommendations"]["summary"]
    assert "image_url" not in r.text
    assert editor.calls == []


def test_analysis_provider_failure_is_safe(client, monkeypatch, editor):
    class Failing:
        name = "failing"

        def analyze(self, *_):
            raise ProviderError("quota exceeded for key sk-123")

    monkeypatch.setattr(main, "get_room_analyzer", lambda: Failing())
    r = analyze(client)
    assert r.status_code == 502 and r.json()["error"] == "analysis_failed"
    assert "sk-123" not in r.text and editor.calls == []


# --- approval gate ---
@pytest.mark.parametrize("approved", [None, "", "false", "yes", "1"])
def test_no_edit_without_explicit_approval(client, editor, approved):
    r = edit(client, approved=approved)
    assert r.status_code == 403 and r.json()["error"] == "approval_required"
    assert editor.calls == []


@pytest.mark.parametrize("instructions", [{"items": []}, {"items": ["   "]}, {"items": ["x" * 501]}, {"notes": "only"}])
def test_edit_requires_approved_instructions(client, editor, instructions):
    r = edit(client, instructions=instructions)
    assert r.status_code == 422 and editor.calls == []


# --- the edit uses the original upload and the approved instructions ---
def test_edit_receives_original_photo_and_approved_instructions(client, editor):
    r = edit(client)
    assert r.status_code == 200
    (req, image, instructions), = editor.calls
    assert image.data == PNG and image.mime_type == "image/png"  # the exact uploaded bytes
    assert instructions.items == APPROVED["items"] and instructions.notes == APPROVED["notes"]
    assert req.style == "scandinavian" and req.room_type == "living room"
    data = r.json()
    assert data["status"] == "edited" and data["image_url"] == EDITED_URL
    assert data["instructions_used"] == APPROVED["items"]


def test_failed_edit_returns_no_image(client, monkeypatch):
    rec = RecordingEditor(fail=True)
    monkeypatch.setattr(main, "get_design_editor", lambda: rec)
    r = edit(client)
    assert r.status_code == 502 and r.json()["error"] == "edit_failed"
    assert "image_url" not in r.text and "data:image" not in r.text
    assert "original photo is unchanged" in r.text
    assert len(rec.calls) == 1  # no retry or fallback generation


def test_mock_editor_is_transparent(client):
    r = edit(client)
    data = r.json()
    assert r.status_code == 200 and data["status"] == "mock" and data["provider"] == "mock"
    assert data["image_url"] is None and data["is_ai_generated"] is False
    assert "no edited photo" in data["message"]


def test_mock_response_can_never_carry_an_image():
    resp = MockDesignEditor().edit(None, None, type("I", (), {"items": ["a"]})())
    assert resp.image_url is None


# --- image validation ---
@pytest.mark.parametrize("endpoint", ["analyze", "edit"])
def test_non_image_upload_rejected(client, editor, endpoint):
    r = (analyze if endpoint == "analyze" else edit)(client, photo=b"GIF89a not allowed")
    assert r.status_code == 422 and r.json()["error"] == "invalid_image"
    assert r.json()["details"][0]["field"] == "photo"
    assert editor.calls == []


def test_disguised_file_rejected(client):
    assert analyze(client, photo=b"#!/bin/sh\necho hi", filename="room.jpg").status_code == 422


def test_empty_upload_rejected(client):
    assert analyze(client, photo=b"").json()["error"] == "invalid_image"


def test_oversized_upload_rejected(client, monkeypatch, editor):
    monkeypatch.setenv("SPACESENSE_MAX_UPLOAD_MB", "0.00001")  # ~10 bytes
    r = edit(client)
    assert r.status_code == 413 and r.json()["error"] == "invalid_image" and editor.calls == []


def test_instructions_must_be_json(client, editor):
    r = client.post("/generate-design", data={"room": json.dumps(VALID), "instructions": "{bad", "approved": "true"},
                    files={"photo": ("r.png", PNG, "image/png")})
    assert r.status_code == 422 and r.json()["details"][0]["field"] == "instructions" and editor.calls == []
