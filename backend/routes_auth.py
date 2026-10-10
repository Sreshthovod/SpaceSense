"""Account routes: sign up, log in/out, email verification, password reset, Google sign-in.

CSRF: every state-changing route requires the header `X-Requested-With: SpaceSense`. A browser cannot
add a custom header to a cross-site request without a CORS preflight, and CORS only approves the
configured frontend origins. Session cookies are also SameSite=Lax and httpOnly.
"""
import hmac
import logging
import os
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel

from services import auth, google_oauth, mailer
from services.imagegen import RateLimiter

logger = logging.getLogger("spacesense.auth")

SESSION_COOKIE = "ss_session"
OAUTH_COOKIE = "ss_oauth"
CSRF_HEADER = ("x-requested-with", "SpaceSense")


def csrf_guard(request: Request) -> None:
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    if request.headers.get(CSRF_HEADER[0]) != CSRF_HEADER[1]:
        raise HTTPException(403, "Missing or invalid request header.")


router = APIRouter(prefix="/auth", dependencies=[Depends(csrf_guard)])

# Account creation and email sending, per client address.
_signup_limiter = RateLimiter(limit=10, window_s=3600)
_email_limiter = RateLimiter(limit=10, window_s=3600)


def reset_limiters() -> None:
    global _signup_limiter, _email_limiter
    _signup_limiter = RateLimiter(limit=10, window_s=3600)
    _email_limiter = RateLimiter(limit=10, window_s=3600)


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def too_many(wait: float) -> auth.AuthError:
    return auth.AuthError(f"Too many attempts. Try again in {int(wait // 60) + 1} minute(s).", 429, retry_after=int(wait) + 1)


def throttle_or_raise(limiter: RateLimiter, request: Request) -> None:
    wait = limiter.check(client_ip(request))
    if wait:
        raise too_many(wait)


# ---- cookies ----------------------------------------------------------------------------------

def secure_cookies() -> bool:
    return os.getenv("SPACESENSE_COOKIE_SECURE", "").strip().lower() in ("1", "true", "yes")


def set_session_cookie(response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE, token, max_age=auth.SESSION_DAYS * 86400, httponly=True, samesite="lax",
        secure=secure_cookies(), path="/",
    )


def clear_session_cookie(response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="lax", secure=secure_cookies())


def current_user(request: Request):
    return auth.user_for_session(request.cookies.get(SESSION_COOKIE))


def require_user(request: Request):
    user = current_user(request)
    if user is None:
        raise auth.AuthError("Please log in.", 401)
    return user


def signed_in(user, status: int = 200, token: str | None = None, **extra) -> JSONResponse:
    response = JSONResponse({"user": auth.public_user(user), **extra}, status_code=status)
    set_session_cookie(response, token or auth.create_session(user["id"]))
    return response


# ---- request bodies ---------------------------------------------------------------------------

class SignupBody(BaseModel):
    email: str
    password: str
    name: str = ""


class LoginBody(BaseModel):
    email: str
    password: str


class EmailBody(BaseModel):
    email: str


class TokenBody(BaseModel):
    token: str


class ResetBody(BaseModel):
    token: str
    new_password: str


class ChangePasswordBody(BaseModel):
    current_password: str = ""
    new_password: str


class DeleteBody(BaseModel):
    password: str = ""
    confirm_email: str = ""


# ---- routes -----------------------------------------------------------------------------------

@router.get("/me")
def me(request: Request):
    user = current_user(request)
    return {
        "user": auth.public_user(user) if user else None,
        "google_enabled": google_oauth.configured(),
        "email_enabled": mailer.configured(),
    }


@router.post("/signup")
def signup(body: SignupBody, request: Request):
    throttle_or_raise(_signup_limiter, request)
    email = auth.normalize_email(body.email)
    password = auth.check_password(body.password, email)
    user = auth.create_user(email, password, auth.clean_name(body.name, email))
    sent = mailer.send_verification(email, user["name"], auth.create_token(user["id"], "verify", timedelta(hours=auth.VERIFY_HOURS)))
    return signed_in(user, 201, verification_email_sent=sent)


@router.post("/login")
def login(body: LoginBody, request: Request):
    email = auth.normalize_email(body.email)
    ip = client_ip(request)
    wait = max(auth.login_by_email.retry_after(email), auth.login_by_ip.retry_after(ip))
    if wait:
        raise too_many(wait)
    password = body.password if isinstance(body.password, str) and len(body.password) <= 1024 else ""
    user = auth.get_user_by_email(email)
    if not auth.verify_password(password, user["password_hash"] if user else None):
        auth.login_by_email.fail(email)
        auth.login_by_ip.fail(ip)
        raise auth.AuthError("Incorrect email or password.", 401)
    auth.login_by_email.clear(email)
    return signed_in(user)


@router.post("/logout")
def logout(request: Request):
    auth.end_session(request.cookies.get(SESSION_COOKIE))
    response = JSONResponse({"ok": True})
    clear_session_cookie(response)
    return response


@router.post("/verify-email")
def verify_email(body: TokenBody):
    auth.mark_verified(auth.use_token(body.token, "verify"))
    return {"ok": True}


@router.post("/resend-verification")
def resend_verification(request: Request):
    user = require_user(request)
    if user["email_verified"]:
        return {"ok": True, "already_verified": True}
    throttle_or_raise(_email_limiter, request)
    token = auth.create_token(user["id"], "verify", timedelta(hours=auth.VERIFY_HOURS))
    return {"ok": True, "sent": mailer.send_verification(user["email"], user["name"], token)}


@router.post("/forgot-password", status_code=202)
def forgot_password(body: EmailBody, request: Request):
    throttle_or_raise(_email_limiter, request)
    email = auth.normalize_email(body.email)
    user = auth.get_user_by_email(email)
    if user:
        token = auth.create_token(user["id"], "reset", timedelta(minutes=auth.RESET_MINUTES))
        mailer.send_password_reset(email, user["name"], token)
    # Same answer whether or not the account exists.
    return {"ok": True}


@router.post("/reset-password")
def reset_password(body: ResetBody):
    new = auth.check_password(body.new_password, field="new_password")  # before the token, so a weak password doesn't burn it
    user_id = auth.use_token(body.token, "reset")
    auth.set_password(user_id, new)
    auth.mark_verified(user_id)  # the link proved they own the mailbox
    auth.end_other_sessions(user_id)
    return {"ok": True}


@router.post("/change-password")
def change_password(body: ChangePasswordBody, request: Request):
    user = require_user(request)
    if user["password_hash"]:
        key = f"change:{user['id']}"
        wait = auth.login_by_email.retry_after(key)
        if wait:
            raise too_many(wait)
        if not auth.verify_password(body.current_password, user["password_hash"]):
            auth.login_by_email.fail(key)
            raise auth.AuthError("Your current password is incorrect.", 400, "current_password")
        auth.login_by_email.clear(key)
    auth.set_password(user["id"], auth.check_password(body.new_password, user["email"], "new_password"))
    auth.end_other_sessions(user["id"], request.cookies.get(SESSION_COOKIE))
    return {"ok": True}


@router.post("/delete-account")
def delete_account(body: DeleteBody, request: Request):
    user = require_user(request)
    if user["password_hash"]:
        if not auth.verify_password(body.password, user["password_hash"]):
            raise auth.AuthError("Your password is incorrect.", 400, "password")
    elif body.confirm_email.strip().lower() != user["email"]:
        raise auth.AuthError("Type your email address to confirm.", 400, "confirm_email")
    auth.delete_user(user["id"])
    response = JSONResponse({"ok": True})
    clear_session_cookie(response)
    return response


# ---- Google -----------------------------------------------------------------------------------

def _frontend(path: str = "") -> str:
    return mailer.frontend_url() + path


@router.get("/google/start")
def google_start():
    if not google_oauth.configured():
        return RedirectResponse(_frontend("/#/login?error=google_unavailable"), status_code=303)
    state, verifier, challenge = google_oauth.new_challenge()
    response = RedirectResponse(google_oauth.authorization_url(state, challenge), status_code=303)
    response.set_cookie(OAUTH_COOKIE, f"{state}.{verifier}", max_age=600, httponly=True, samesite="lax", secure=secure_cookies(), path="/auth/google")
    return response


@router.get("/google/callback")
def google_callback(request: Request, code: str = "", state: str = "", error: str = ""):
    failure = RedirectResponse(_frontend("/#/login?error=google"), status_code=303)
    failure.delete_cookie(OAUTH_COOKIE, path="/auth/google")
    saved = request.cookies.get(OAUTH_COOKIE, "")
    expected_state, _, verifier = saved.partition(".")
    if error or not code or not expected_state or not verifier or not hmac.compare_digest(expected_state, state):
        return failure
    try:
        profile = google_oauth.fetch_profile(code, verifier)
        user = auth.sign_in_with_google(profile["sub"], profile["email"], profile["name"])
    except (google_oauth.GoogleError, auth.AuthError) as exc:
        logger.warning("Google sign-in failed: %s", exc)
        return failure
    response = RedirectResponse(_frontend("/"), status_code=303)
    response.delete_cookie(OAUTH_COOKIE, path="/auth/google")
    set_session_cookie(response, auth.create_session(user["id"]))
    return response
