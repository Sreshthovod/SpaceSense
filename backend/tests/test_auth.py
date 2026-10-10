import re
import sqlite3
from datetime import timedelta
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

import main
from services import auth, google_oauth, mailer

H = {"X-Requested-With": "SpaceSense"}
GOOD = "correct horse battery"


@pytest.fixture
def mails(monkeypatch):
    """Captured outgoing mail: list of (to, subject, body)."""
    sent = []
    monkeypatch.setattr(mailer, "send_email", lambda to, subject, body: sent.append((to, subject, body)) or True)
    return sent


@pytest.fixture
def api(catalog_file, mails):
    return TestClient(main.app, raise_server_exceptions=False)


def post(api, path, json=None, headers=H):
    return api.post(f"/auth/{path}", json=json, headers=headers)


def signup(api, email="Ada@Example.com", password=GOOD, name="Ada"):
    return post(api, "signup", {"email": email, "password": password, "name": name})


def link_token(mails, index=-1):
    return re.search(r"token=([\w-]+)", mails[index][2])[1]


# ---- sign up ----------------------------------------------------------------------------------

def test_signup_creates_account_logs_in_and_sends_verification(api, mails):
    res = signup(api)
    assert res.status_code == 201
    user = res.json()["user"]
    assert user["email"] == "ada@example.com" and user["name"] == "Ada"
    assert user["email_verified"] is False and user["has_password"] is True
    assert "password" not in str(res.json()).lower().replace("has_password", "")
    cookie = res.headers["set-cookie"].lower()
    assert "ss_session=" in cookie and "httponly" in cookie and "samesite=lax" in cookie
    assert api.get("/auth/me").json()["user"]["email"] == "ada@example.com"
    assert mails[0][0] == "ada@example.com" and "/#/verify-email?token=" in mails[0][2]


def test_signup_validation(api):
    bad = [
        ({"email": "nope", "password": GOOD}, "email"),
        ({"email": "a@b.co", "password": "short"}, "password"),
        ({"email": "a@b.co", "password": "x" * 129}, "password"),
        ({"email": "a@b.co", "password": "password123"}, "password"),
        ({"email": "a@b.com", "password": "A@B.COM"}, "password"),
        ({"email": "a@b.co", "password": GOOD, "name": "n" * 81}, "name"),
    ]
    for body, field in bad:
        res = post(api, "signup", body)
        assert res.status_code == 400, body
        assert res.json()["details"][0]["field"] == field


def test_duplicate_email_is_a_409_regardless_of_case(api):
    assert signup(api).status_code == 201
    res = signup(api, email="ADA@example.com")
    assert res.status_code == 409 and res.json()["details"][0]["field"] == "email"


def test_name_defaults_to_the_email_prefix(api):
    assert signup(api, name="  ").json()["user"]["name"] == "ada"


def test_secure_cookie_flag_follows_the_setting(api, monkeypatch):
    monkeypatch.setenv("SPACESENSE_COOKIE_SECURE", "true")
    assert "secure" in signup(api).headers["set-cookie"].lower()


def test_signup_is_rate_limited_per_ip(api):
    codes = [signup(api, email=f"u{i}@example.com").status_code for i in range(11)]
    assert codes[:10] == [201] * 10 and codes[10] == 429


# ---- CSRF header ------------------------------------------------------------------------------

def test_state_changing_routes_require_the_custom_header(api):
    for path in ("signup", "login", "logout", "forgot-password", "reset-password", "verify-email", "change-password"):
        res = post(api, path, {"email": "a@b.co", "password": GOOD}, headers={})
        assert res.status_code == 403, path
    assert api.get("/auth/me").status_code == 200  # reads need no header


# ---- login / logout ---------------------------------------------------------------------------

def test_login_and_logout_round_trip(api):
    signup(api)
    post(api, "logout")
    assert api.get("/auth/me").json()["user"] is None
    res = post(api, "login", {"email": " ADA@example.com ", "password": GOOD})
    assert res.status_code == 200 and res.json()["user"]["email"] == "ada@example.com"
    assert api.get("/auth/me").json()["user"] is not None
    out = post(api, "logout")
    assert out.status_code == 200 and "ss_session=" in out.headers["set-cookie"]
    assert api.get("/auth/me").json()["user"] is None


def test_wrong_password_and_unknown_email_look_identical(api):
    signup(api)
    post(api, "logout")
    a = post(api, "login", {"email": "ada@example.com", "password": "wrong-password-1"})
    b = post(api, "login", {"email": "nobody@example.com", "password": "wrong-password-1"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json() and "Incorrect email or password" in a.json()["details"][0]["message"]
    assert "set-cookie" not in a.headers


def test_login_locks_out_after_repeated_failures_even_with_the_right_password(api):
    signup(api)
    post(api, "logout")
    for _ in range(5):
        assert post(api, "login", {"email": "ada@example.com", "password": "wrong-password-1"}).status_code == 401
    locked = post(api, "login", {"email": "ada@example.com", "password": GOOD})
    assert locked.status_code == 429 and int(locked.headers["Retry-After"]) > 0
    assert api.get("/auth/me").json()["user"] is None


def test_successful_login_resets_the_failure_count(api):
    signup(api)
    post(api, "logout")
    for _ in range(4):
        post(api, "login", {"email": "ada@example.com", "password": "wrong-password-1"})
    assert post(api, "login", {"email": "ada@example.com", "password": GOOD}).status_code == 200
    post(api, "logout")
    assert post(api, "login", {"email": "ada@example.com", "password": "wrong-password-1"}).status_code == 401


def test_a_session_cookie_is_useless_after_logout_and_the_database_stores_only_hashes(api, tmp_path):
    token = signup(api).cookies["ss_session"]
    conn = sqlite3.connect(tmp_path / "test.db")
    stored = [r[0] for r in conn.execute("SELECT token_hash FROM sessions")]
    assert token not in stored and len(stored[0]) == 64
    pw = conn.execute("SELECT password_hash FROM users").fetchone()[0]
    assert pw.startswith("scrypt$") and GOOD not in pw
    post(api, "logout")
    fresh = TestClient(main.app, cookies={"ss_session": token})
    assert fresh.get("/auth/me").json()["user"] is None


def test_expired_sessions_are_rejected(api):
    token = signup(api).cookies["ss_session"]
    with auth.connect() as db:
        db.execute("UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000000Z'")
    assert TestClient(main.app, cookies={"ss_session": token}).get("/auth/me").json()["user"] is None


# ---- email verification -----------------------------------------------------------------------

def test_verify_email_marks_the_account_and_the_link_works_once(api, mails):
    signup(api)
    token = link_token(mails)
    assert post(api, "verify-email", {"token": token}).status_code == 200
    assert api.get("/auth/me").json()["user"]["email_verified"] is True
    again = post(api, "verify-email", {"token": token})
    assert again.status_code == 400 and "invalid or has expired" in again.json()["details"][0]["message"]


def test_bad_and_expired_verification_tokens_are_rejected(api, mails):
    signup(api)
    assert post(api, "verify-email", {"token": "garbage"}).status_code == 400
    with auth.connect() as db:
        db.execute("UPDATE tokens SET expires_at = '2000-01-01T00:00:00.000000Z'")
    assert post(api, "verify-email", {"token": link_token(mails)}).status_code == 400


def test_a_reset_token_cannot_verify_email(api, mails):
    signup(api)
    post(api, "forgot-password", {"email": "ada@example.com"})
    assert post(api, "verify-email", {"token": link_token(mails)}).status_code == 400


def test_resend_verification(api, mails):
    assert post(api, "resend-verification").status_code == 401
    signup(api)
    first = link_token(mails)
    res = post(api, "resend-verification")
    assert res.json()["sent"] is True and len(mails) == 2
    assert post(api, "verify-email", {"token": first}).status_code == 400  # only the newest link works
    assert post(api, "verify-email", {"token": link_token(mails)}).status_code == 200
    assert post(api, "resend-verification").json()["already_verified"] is True and len(mails) == 2


# ---- password reset ---------------------------------------------------------------------------

def test_forgot_password_answers_the_same_for_unknown_emails_and_sends_nothing(api, mails):
    signup(api)
    mails.clear()
    unknown = post(api, "forgot-password", {"email": "nobody@example.com"})
    known = post(api, "forgot-password", {"email": "ada@example.com"})
    assert unknown.status_code == known.status_code == 202 and unknown.json() == known.json()
    assert [m[0] for m in mails] == ["ada@example.com"] and "/#/reset-password?token=" in mails[0][2]


def test_reset_password_sets_it_ends_every_session_and_the_link_is_single_use(api, mails):
    signup(api)
    post(api, "forgot-password", {"email": "ada@example.com"})
    token = link_token(mails)
    other = TestClient(main.app, raise_server_exceptions=False)
    post(other, "login", {"email": "ada@example.com", "password": GOOD})
    assert post(api, "reset-password", {"token": token, "new_password": "a brand new passphrase"}).status_code == 200
    assert api.get("/auth/me").json()["user"] is None and other.get("/auth/me").json()["user"] is None
    assert post(api, "login", {"email": "ada@example.com", "password": GOOD}).status_code == 401
    assert post(api, "login", {"email": "ada@example.com", "password": "a brand new passphrase"}).status_code == 200
    assert api.get("/auth/me").json()["user"]["email_verified"] is True  # the link proved mailbox ownership
    assert post(api, "reset-password", {"token": token, "new_password": "another new passphrase"}).status_code == 400


def test_a_weak_new_password_does_not_use_up_the_reset_link(api, mails):
    signup(api)
    post(api, "forgot-password", {"email": "ada@example.com"})
    token = link_token(mails)
    assert post(api, "reset-password", {"token": token, "new_password": "short"}).status_code == 400
    assert post(api, "reset-password", {"token": token, "new_password": "a brand new passphrase"}).status_code == 200


def test_only_the_newest_reset_link_works(api, mails):
    signup(api)
    post(api, "forgot-password", {"email": "ada@example.com"})
    old = link_token(mails)
    post(api, "forgot-password", {"email": "ada@example.com"})
    assert post(api, "reset-password", {"token": old, "new_password": "a brand new passphrase"}).status_code == 400


# ---- change password / delete -----------------------------------------------------------------

def test_change_password_needs_the_current_one_and_keeps_only_this_session(api):
    signup(api)
    other = TestClient(main.app, raise_server_exceptions=False)
    post(other, "login", {"email": "ada@example.com", "password": GOOD})
    wrong = post(api, "change-password", {"current_password": "nope-nope-nope", "new_password": "a brand new passphrase"})
    assert wrong.status_code == 400 and wrong.json()["details"][0]["field"] == "current_password"
    assert post(api, "change-password", {"current_password": GOOD, "new_password": "a brand new passphrase"}).status_code == 200
    assert api.get("/auth/me").json()["user"] is not None
    assert other.get("/auth/me").json()["user"] is None


def test_change_password_requires_login_and_is_throttled(api):
    assert post(api, "change-password", {"current_password": GOOD, "new_password": "a brand new passphrase"}).status_code == 401
    signup(api)
    codes = [post(api, "change-password", {"current_password": "nope-nope-nope", "new_password": "a brand new passphrase"}).status_code for _ in range(6)]
    assert codes == [400] * 5 + [429]


def test_delete_account_needs_the_password_and_removes_everything(api, tmp_path):
    signup(api)
    assert post(api, "delete-account", {"password": "wrong-password-1"}).status_code == 400
    assert api.get("/auth/me").json()["user"] is not None
    assert post(api, "delete-account", {"password": GOOD}).status_code == 200
    assert api.get("/auth/me").json()["user"] is None
    conn = sqlite3.connect(tmp_path / "test.db")
    assert [conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in ("users", "sessions", "tokens")] == [0, 0, 0]
    assert post(api, "login", {"email": "ada@example.com", "password": GOOD}).status_code == 401


# ---- Google -----------------------------------------------------------------------------------

@pytest.fixture
def google(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "client-secret")
    profile = {"sub": "g-123", "email": "grace@example.com", "name": "Grace"}
    calls = []
    monkeypatch.setattr(google_oauth, "fetch_profile", lambda code, verifier: calls.append((code, verifier)) or profile)
    return profile, calls


def start(api):
    res = api.get("/auth/google/start", follow_redirects=False)
    assert res.status_code == 303
    return urlparse(res.headers["location"]), parse_qs(urlparse(res.headers["location"]).query)


def test_google_start_redirects_with_state_and_pkce(api, google):
    url, q = start(api)
    assert url.netloc == "accounts.google.com"
    assert q["client_id"] == ["client-id"] and q["code_challenge_method"] == ["S256"] and q["state"][0]
    assert q["redirect_uri"] == ["http://localhost:8000/auth/google/callback"]
    assert "ss_oauth=" in api.cookies.jar.__repr__() or any(c.name == "ss_oauth" for c in api.cookies.jar)


def test_google_start_when_not_configured_goes_back_to_login(api):
    res = api.get("/auth/google/start", follow_redirects=False)
    assert "error=google_unavailable" in res.headers["location"]
    assert api.get("/auth/me").json()["google_enabled"] is False


def test_google_callback_creates_a_verified_account_and_signs_in(api, google):
    profile, calls = google
    _, q = start(api)
    res = api.get("/auth/google/callback", params={"code": "abc", "state": q["state"][0]}, follow_redirects=False)
    assert res.status_code == 303 and res.headers["location"] == "http://localhost:5173/"
    assert calls[0][0] == "abc"
    user = api.get("/auth/me").json()["user"]
    assert user["email"] == "grace@example.com" and user["email_verified"] and user["google_linked"] and not user["has_password"]


def test_google_callback_rejects_a_wrong_state_or_a_missing_cookie(api, google):
    _, calls = google
    start(api)
    res = api.get("/auth/google/callback", params={"code": "abc", "state": "forged"}, follow_redirects=False)
    assert "error=google" in res.headers["location"] and calls == []
    assert api.get("/auth/me").json()["user"] is None
    stranger = TestClient(main.app)
    res = stranger.get("/auth/google/callback", params={"code": "abc", "state": "x"}, follow_redirects=False)
    assert "error=google" in res.headers["location"] and calls == []
    res = api.get("/auth/google/callback", params={"error": "access_denied", "state": "x"}, follow_redirects=False)
    assert "error=google" in res.headers["location"]


def test_google_links_to_an_existing_verified_account_by_email(api, google, mails):
    profile, _ = google
    signup(api, email="grace@example.com", name="Grace")
    post(api, "verify-email", {"token": link_token(mails)})
    post(api, "logout")
    _, q = start(api)
    api.get("/auth/google/callback", params={"code": "abc", "state": q["state"][0]}, follow_redirects=False)
    user = api.get("/auth/me").json()["user"]
    assert user["google_linked"] and user["has_password"]
    with auth.connect() as db:
        assert db.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 1


def test_google_takeover_of_an_unverified_password_account_drops_the_password_and_sessions(api, google):
    signup(api, email="grace@example.com", password=GOOD)  # attacker registered the address, never verified it
    attacker = TestClient(main.app, raise_server_exceptions=False)
    post(attacker, "login", {"email": "grace@example.com", "password": GOOD})
    victim = TestClient(main.app, raise_server_exceptions=False)
    _, q = start(victim)
    victim.get("/auth/google/callback", params={"code": "abc", "state": q["state"][0]}, follow_redirects=False)
    assert victim.get("/auth/me").json()["user"]["email_verified"] is True
    assert attacker.get("/auth/me").json()["user"] is None
    assert post(attacker, "login", {"email": "grace@example.com", "password": GOOD}).status_code == 401


def test_google_only_accounts_can_set_a_password_without_a_current_one(api, google):
    _, q = start(api)
    api.get("/auth/google/callback", params={"code": "abc", "state": q["state"][0]}, follow_redirects=False)
    assert post(api, "change-password", {"new_password": "a brand new passphrase"}).status_code == 200
    assert api.get("/auth/me").json()["user"]["has_password"] is True
    assert post(api, "login", {"email": "grace@example.com", "password": "a brand new passphrase"}).status_code == 200


# ---- units ------------------------------------------------------------------------------------

def test_password_hashes_are_salted_and_verify():
    a, b = auth.hash_password(GOOD), auth.hash_password(GOOD)
    assert a != b and auth.verify_password(GOOD, a) and not auth.verify_password("other", a)
    assert not auth.verify_password(GOOD, None) and not auth.verify_password(GOOD, "garbage")


def test_cors_allows_credentials_only_for_the_frontend_origin(api):
    ok = api.options("/auth/login", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST",
                                              "Access-Control-Request-Headers": "x-requested-with,content-type"})
    assert ok.headers["access-control-allow-credentials"] == "true"
    assert ok.headers["access-control-allow-origin"] == "http://localhost:5173"
    evil = api.options("/auth/login", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST",
                                                "Access-Control-Request-Headers": "x-requested-with"})
    assert "access-control-allow-origin" not in evil.headers


def test_smtp_failures_do_not_break_signup(api, monkeypatch):
    monkeypatch.setattr(mailer, "send_email", lambda *a: False)
    res = signup(api)
    assert res.status_code == 201 and res.json()["verification_email_sent"] is False


def test_mailer_without_smtp_only_logs(monkeypatch, caplog):
    monkeypatch.undo()
    monkeypatch.delenv("SMTP_HOST", raising=False)
    assert mailer.send_email("a@b.co", "Hi", "body") is False
    assert "SMTP is not configured" in caplog.text
