"""Sign in with Google (OAuth 2.0 authorization code flow with PKCE).

Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. In Google Cloud Console, add this exact redirect URI
to the OAuth client: SPACESENSE_API_URL + /auth/google/callback (default http://localhost:8000/...).
"""
import base64
import hashlib
import json
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


class GoogleError(Exception):
    pass


def configured() -> bool:
    return bool(os.getenv("GOOGLE_CLIENT_ID", "").strip() and os.getenv("GOOGLE_CLIENT_SECRET", "").strip())


def redirect_uri() -> str:
    return os.getenv("SPACESENSE_API_URL", "http://localhost:8000").rstrip("/") + "/auth/google/callback"


def new_challenge() -> tuple[str, str, str]:
    """Returns (state, code_verifier, code_challenge)."""
    state = secrets.token_urlsafe(24)
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return state, verifier, challenge


def authorization_url(state: str, challenge: str) -> str:
    query = urllib.parse.urlencode({
        "client_id": os.getenv("GOOGLE_CLIENT_ID", "").strip(),
        "redirect_uri": redirect_uri(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "prompt": "select_account",
    })
    return f"{AUTH_URL}?{query}"


def _request(req: urllib.request.Request) -> dict:
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return json.loads(res.read(1024 * 1024))
    except (urllib.error.URLError, OSError, ValueError) as exc:
        raise GoogleError(type(exc).__name__) from None


def fetch_profile(code: str, verifier: str) -> dict:
    """Exchange the code and return {sub, email, name}. Only Google-verified emails are accepted."""
    body = urllib.parse.urlencode({
        "code": code,
        "client_id": os.getenv("GOOGLE_CLIENT_ID", "").strip(),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", "").strip(),
        "redirect_uri": redirect_uri(),
        "grant_type": "authorization_code",
        "code_verifier": verifier,
    }).encode()
    token = _request(urllib.request.Request(TOKEN_URL, data=body, method="POST"))
    access = token.get("access_token")
    if not isinstance(access, str):
        raise GoogleError("no access token")
    info = _request(urllib.request.Request(USERINFO_URL, headers={"Authorization": f"Bearer {access}"}))
    sub, email = info.get("sub"), info.get("email")
    if not isinstance(sub, str) or not isinstance(email, str) or info.get("email_verified") is not True:
        raise GoogleError("email not verified")
    return {"sub": sub, "email": email.strip().lower(), "name": str(info.get("name") or "")[:80]}
