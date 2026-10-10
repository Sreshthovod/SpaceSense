import base64
import io
import json
import urllib.error

import cv2
import numpy as np
import pytest

from services import imagegen
from tests.conftest import PNG

JPEG_B64 = base64.b64encode(b"\xff\xd8\xff\xe0" + b"0" * 40).decode()
TOKEN = "cfut_secret_token_value"


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload if isinstance(payload, bytes) else json.dumps(payload).encode()

    def read(self, n=-1):
        return self.payload

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


@pytest.fixture
def cf(monkeypatch):
    """Credentials set, urlopen replaced. `cf.calls` records the requests; `cf.reply` is what comes back."""
    monkeypatch.setenv("CF_ACCOUNT_ID", "abcdef0123456789")
    monkeypatch.setenv("CF_API_TOKEN", TOKEN)

    class State:
        calls = []
        reply = {"success": True, "result": {"image": JPEG_B64}}

    def fake_urlopen(req, timeout=None):
        State.calls.append((req, timeout))
        if isinstance(State.reply, Exception):
            raise State.reply
        return FakeResponse(State.reply)

    monkeypatch.setattr(imagegen.urllib.request, "urlopen", fake_urlopen)
    return State


def http_error(status, errors):
    return urllib.error.HTTPError("https://x", status, "err", {}, io.BytesIO(json.dumps({"errors": errors}).encode()))


def gen(client, body=None):
    return client.post("/api/generate-image", json={"prompt": "a cosy room"} if body is None else body)


def png_bytes(w, h):
    ok, buf = cv2.imencode(".png", np.full((h, w, 3), 120, np.uint8))
    return buf.tobytes()


def edit(client, data=PNG, prompt="make it warmer", name="a.png"):
    return client.post("/api/edit-image", data={"prompt": prompt}, files={"image": (name, data, "image/png")})


# ---- text to image ----------------------------------------------------------------------------

def test_generate_returns_data_url_and_calls_cloudflare_correctly(client, cf):
    res = gen(client, {"prompt": " a cosy room ", "steps": 6})
    assert res.status_code == 200
    assert res.json()["image"] == f"data:image/jpeg;base64,{JPEG_B64}"
    req, timeout = cf.calls[0]
    assert req.full_url == "https://api.cloudflare.com/client/v4/accounts/abcdef0123456789/ai/run/@cf/black-forest-labs/flux-1-schnell"
    assert req.get_header("Authorization") == f"Bearer {TOKEN}"
    assert req.get_header("Content-type") == "application/json"
    assert json.loads(req.data) == {"prompt": "a cosy room", "steps": 6}
    assert timeout == 60


def test_steps_default_to_four(client, cf):
    gen(client, {"prompt": "x"})
    assert json.loads(cf.calls[0][0].data)["steps"] == 4


@pytest.mark.parametrize("body,field", [
    ({}, "prompt"), ({"prompt": ""}, "prompt"), ({"prompt": "   "}, "prompt"), ({"prompt": 5}, "prompt"),
    ({"prompt": "x" * 2049}, "prompt"),
    ({"prompt": "x", "steps": 0}, "steps"), ({"prompt": "x", "steps": 9}, "steps"),
    ({"prompt": "x", "steps": "4"}, "steps"), ({"prompt": "x", "steps": 2.5}, "steps"), ({"prompt": "x", "steps": True}, "steps"),
])
def test_invalid_input_is_a_400_and_never_reaches_cloudflare(client, cf, body, field):
    res = gen(client, body)
    assert res.status_code == 400
    assert res.json()["error"] == "invalid_request"
    assert res.json()["details"][0]["field"] == field
    assert cf.calls == []


def test_limits_are_accepted(client, cf):
    assert gen(client, {"prompt": "x" * 2048, "steps": 8}).status_code == 200
    assert gen(client, {"prompt": "x", "steps": 1}).status_code == 200


def test_non_json_body_is_a_400(client, cf):
    assert client.post("/api/generate-image", content=b"nope", headers={"Content-Type": "application/json"}).status_code == 400
    assert gen(client, ["a"]).status_code == 400


def test_missing_credentials_is_503(client):
    res = gen(client)
    assert res.status_code == 503
    assert "isn't set up" in res.json()["details"][0]["message"]


@pytest.mark.parametrize("failure,status", [
    (http_error(429, []), 429),
    (http_error(400, [{"code": 4006, "message": "you have used up your daily free allocation of 10,000 neurons"}]), 429),
    (http_error(401, [{"code": 10000, "message": "Authentication error"}]), 502),
    (http_error(400, [{"code": 5006, "message": "bad input"}]), 502),
    (http_error(500, []), 502),
    (TimeoutError(), 504),
    (urllib.error.URLError(TimeoutError()), 504),
    (urllib.error.URLError(ConnectionRefusedError()), 502),
])
def test_cloudflare_failures_map_to_friendly_errors(client, cf, failure, status):
    cf.reply = failure
    res = gen(client)
    assert res.status_code == status
    assert res.json()["error"] == "image_generation_failed"
    assert TOKEN not in res.text


def test_quota_message_is_clear(client, cf):
    cf.reply = http_error(429, [{"message": "neurons exhausted"}])
    assert "allowance has been used up" in gen(client).json()["details"][0]["message"]


@pytest.mark.parametrize("reply", [
    {"success": False, "errors": [{"code": 1, "message": "boom"}]},
    {"success": True, "result": {}},
    {"success": True, "result": {"image": "!!not base64!!"}},
    {"success": True},
    [],
])
def test_bad_success_payloads_are_502(client, cf, reply):
    cf.reply = reply
    assert gen(client).status_code == 502


def test_png_response_gets_png_mime(client, cf):
    cf.reply = {"success": True, "result": {"image": base64.b64encode(PNG).decode()}}
    assert gen(client).json()["image"].startswith("data:image/png;base64,")


def test_rate_limit_per_ip(client, cf, monkeypatch):
    monkeypatch.setenv("SPACESENSE_IMAGEGEN_RATE_PER_MIN", "2")
    imagegen.reset_rate_limiter()
    assert [gen(client).status_code for _ in range(3)] == [200, 200, 429]
    res = gen(client)
    assert res.json()["error"] == "rate_limited"
    assert int(res.headers["Retry-After"]) >= 1


def test_rate_limiter_window_expires():
    rl = imagegen.RateLimiter(limit=1, window_s=60)
    assert rl.check("a", now=0) == 0
    assert rl.check("a", now=10) == 50
    assert rl.check("b", now=10) == 0
    assert rl.check("a", now=61) == 0


def test_rate_limiter_bounds_memory():
    rl = imagegen.RateLimiter(limit=1, window_s=1, max_clients=3)
    for i in range(10):
        rl.check(f"ip{i}", now=i * 5)
    assert len(rl._hits) <= 4


# ---- image to image ---------------------------------------------------------------------------

def test_edit_sends_multipart_with_resized_reference(client, cf):
    res = edit(client, png_bytes(1000, 500))
    assert res.status_code == 200
    assert res.json()["image"].startswith("data:image/jpeg;base64,")
    req, _ = cf.calls[0]
    assert req.full_url.endswith("/ai/run/@cf/black-forest-labs/flux-2-klein-4b")
    assert req.get_header("Authorization") == f"Bearer {TOKEN}"
    assert req.get_header("Content-type").startswith("multipart/form-data; boundary=")
    body = req.data
    assert b'name="prompt"\r\n\r\nmake it warmer' in body
    assert b'name="width"\r\n\r\n480' in body and b'name="height"\r\n\r\n256' in body  # 240 raised to the model's 256 minimum
    assert b'name="input_image_0"; filename="input.png"' in body
    start = body.index(b"\x89PNG")
    sent = cv2.imdecode(np.frombuffer(body[start:], np.uint8), cv2.IMREAD_COLOR)
    assert sent.shape[:2] == (240, 480)  # under the model's 512x512 limit


def test_edit_output_size_is_clamped_to_model_range(client, cf):
    edit(client, png_bytes(40, 40))
    assert b'name="width"\r\n\r\n256' in cf.calls[0][0].data


def test_edit_rejects_wrong_type_even_with_image_name(client, cf):
    res = edit(client, b"GIF89a....", name="a.png")
    assert res.status_code == 400 and res.json()["details"][0]["field"] == "image"


def test_edit_rejects_corrupt_image(client, cf):
    assert edit(client, PNG[:20]).status_code == 400
    assert cf.calls == []


def test_edit_rejects_oversize_and_empty(client, cf):
    assert edit(client, PNG + b"0" * (5 * 1024 * 1024)).status_code == 413
    assert edit(client, b"").status_code == 400


def test_edit_validates_prompt(client, cf):
    assert edit(client, prompt="").status_code == 400
    assert edit(client, prompt="x" * 2049).status_code == 400
    assert cf.calls == []


def test_edit_failure_and_missing_image(client, cf):
    cf.reply = http_error(429, [])
    assert edit(client).status_code == 429
    assert client.post("/api/edit-image", data={"prompt": "x"}).status_code == 422


def test_edit_shares_rate_limit(client, cf, monkeypatch):
    monkeypatch.setenv("SPACESENSE_IMAGEGEN_RATE_PER_MIN", "1")
    imagegen.reset_rate_limiter()
    assert gen(client).status_code == 200
    assert edit(client).status_code == 429


# ---- provider choice (gemini) -----------------------------------------------------------------

class _Blob:
    def __init__(self, data, mime_type):
        self.data, self.mime_type = data, mime_type


class _Part:
    def __init__(self, blob=None):
        self.inline_data = blob


class _Response:
    def __init__(self, parts):
        content = type("C", (), {"parts": parts})()
        self.candidates = [type("Cand", (), {"content": content, "finish_reason": "STOP"})()]


class FakeGemini:
    def __init__(self, response=None, error=None):
        self.calls, self.response, self.error = [], response, error
        self.models = self

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return self.response


@pytest.fixture
def gem(monkeypatch):
    fake = FakeGemini(_Response([_Part(), _Part(_Blob(b"\x89PNG\r\n\x1a\nxx", "image/png"))]))
    monkeypatch.setattr("services.providers._gemini_client", lambda: fake)
    return fake


def test_gemini_text_to_image(client, gem):
    res = gen(client, {"prompt": "a cosy room", "provider": "gemini"})
    assert res.status_code == 200
    assert res.json()["provider"] == "gemini"
    assert res.json()["image"] == "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\nxx").decode()
    assert gem.calls[0]["contents"] == ["a cosy room"]
    assert list(gem.calls[0]["config"].response_modalities) == ["TEXT", "IMAGE"]


def test_gemini_sends_the_uploaded_image_unshrunk(client, gem):
    big = png_bytes(1000, 500)
    res = client.post("/api/edit-image", data={"prompt": "warmer", "provider": "gemini"},
                      files={"image": ("a.png", big, "image/png")})
    assert res.status_code == 200 and res.json()["provider"] == "gemini"
    part, prompt = gem.calls[0]["contents"]
    assert prompt == "warmer"
    assert part.inline_data.data == big and part.inline_data.mime_type == "image/png"


def test_gemini_edit_validates_upload(client, gem):
    res = client.post("/api/edit-image", data={"prompt": "x", "provider": "gemini"},
                      files={"image": ("a.png", b"GIF89a....", "image/png")})
    assert res.status_code == 400 and gem.calls == []


def test_default_provider_is_cloudflare(client, cf):
    assert gen(client).json()["provider"] == "cloudflare"
    assert edit(client).json()["provider"] == "cloudflare"


@pytest.mark.parametrize("value", ["openai", 5, "GEMINI"])
def test_unknown_provider_is_a_400(client, cf, value):
    res = gen(client, {"prompt": "x", "provider": value})
    assert res.status_code == 400 and res.json()["details"][0]["field"] == "provider"
    res = client.post("/api/edit-image", data={"prompt": "x", "provider": str(value)}, files={"image": ("a.png", PNG, "image/png")})
    assert res.status_code == 400 and cf.calls == []


def test_gemini_without_key_is_503_naming_gemini(client):
    res = gen(client, {"prompt": "x", "provider": "gemini"})
    assert res.status_code == 503 and res.json()["details"][0]["message"].startswith("Gemini")


class _Err(Exception):
    def __init__(self, code):
        self.code = code


@pytest.mark.parametrize("error,status", [(_Err(429), 429), (_Err(403), 502), (_Err(504), 504), (_Err(500), 502)])
def test_gemini_failures_map_to_friendly_errors(client, gem, error, status):
    gem.error = error
    res = gen(client, {"prompt": "x", "provider": "gemini"})
    assert res.status_code == status and res.json()["error"] == "image_generation_failed"


def test_gemini_text_only_reply_is_a_rejection(client, gem):
    gem.response = _Response([_Part()])
    res = gen(client, {"prompt": "x", "provider": "gemini"})
    assert res.status_code == 502 and "couldn't process" in res.json()["details"][0]["message"]


def test_quota_message_names_the_provider_and_suggests_the_other(client, gem):
    gem.error = _Err(429)
    msg = gen(client, {"prompt": "x", "provider": "gemini"}).json()["details"][0]["message"]
    assert msg.startswith("The Gemini allowance") and "other provider" in msg


def test_image_providers_reports_configured_keys(client, monkeypatch):
    assert client.get("/api/image-providers").json() == {"cloudflare": False, "gemini": False}
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    monkeypatch.setenv("CF_ACCOUNT_ID", "abcdef0123456789")
    assert client.get("/api/image-providers").json() == {"cloudflare": False, "gemini": True}
    monkeypatch.setenv("CF_API_TOKEN", "t")
    assert client.get("/api/image-providers").json()["cloudflare"] is True
