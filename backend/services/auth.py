"""Accounts, sessions and one-time tokens, stored in SQLite (standard library only).

- Passwords are hashed with scrypt and a random salt; the parameters are stored with the hash.
- A session is a random token in an httpOnly cookie. Only its SHA-256 is stored, so a leaked
  database cannot be used to sign in.
- Email verification and password reset use single-use, expiring tokens, also stored hashed.
"""
import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import threading
import time
from collections import deque
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "spacesense.db"
SESSION_DAYS = 14
VERIFY_HOURS = 24
RESET_MINUTES = 60

PASSWORD_MIN, PASSWORD_MAX = 10, 128
_COMMON = {
    "password", "password1", "password12", "password123", "1234567890", "12345678910", "qwertyuiop",
    "qwerty12345", "iloveyou12", "letmein123", "welcome123", "admin12345", "abcdefghij", "0123456789",
}
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    google_sub TEXT UNIQUE,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS tokens (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT
);
CREATE INDEX IF NOT EXISTS tokens_user ON tokens(user_id, kind);
"""


class AuthError(Exception):
    """A request the user can fix. `status` and `field` shape the API response."""

    def __init__(self, message: str, status: int = 400, field: str = "body", retry_after: int | None = None):
        super().__init__(message)
        self.status, self.field, self.retry_after = status, field, retry_after


# ---- database ---------------------------------------------------------------------------------

def db_path() -> Path:
    return Path(os.getenv("SPACESENSE_DB_PATH") or DEFAULT_DB_PATH)


_init_lock = threading.Lock()
_initialised: set[str] = set()


@contextmanager
def connect():
    path = db_path()
    with _init_lock:
        if str(path) not in _initialised:
            path.parent.mkdir(parents=True, exist_ok=True)
            boot = sqlite3.connect(path)
            boot.execute("PRAGMA journal_mode=WAL")
            boot.executescript(SCHEMA)
            boot.commit()
            boot.close()
            _initialised.add(str(path))
    conn = sqlite3.connect(path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        with conn:  # commit on success, roll back on error
            yield conn
    finally:
        conn.close()


def init_db() -> None:
    with connect():
        pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _sha(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ---- validation -------------------------------------------------------------------------------

def normalize_email(email) -> str:
    if not isinstance(email, str):
        raise AuthError("Enter a valid email address.", 400, "email")
    email = email.strip().lower()
    if len(email) > 254 or not _EMAIL.match(email):
        raise AuthError("Enter a valid email address.", 400, "email")
    return email


def check_password(password, email: str = "", field: str = "password") -> str:
    if not isinstance(password, str) or len(password) < PASSWORD_MIN:
        raise AuthError(f"Use at least {PASSWORD_MIN} characters.", 400, field)
    if len(password) > PASSWORD_MAX:
        raise AuthError(f"Use {PASSWORD_MAX} characters or fewer.", 400, field)
    if password.lower() in _COMMON or (email and password.lower() == email.lower()):
        raise AuthError("That password is too easy to guess. Choose another.", 400, field)
    return password


def clean_name(name, email: str) -> str:
    name = (name or "").strip() if isinstance(name, str) else ""
    if len(name) > 80:
        raise AuthError("Use 80 characters or fewer for your name.", 400, "name")
    return name or email.split("@")[0]


# ---- passwords --------------------------------------------------------------------------------

def _scrypt_n() -> int:
    return int(os.getenv("SPACESENSE_SCRYPT_N", 2**15))


def hash_password(password: str) -> str:
    n, r, p = _scrypt_n(), 8, 1
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=n, r=r, p=p, dklen=32, maxmem=256 * 1024 * 1024)
    return f"scrypt${n}${r}${p}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str | None) -> bool:
    """Constant-work check. A missing hash still costs a hash, so timing does not reveal accounts."""
    if not stored:
        verify_password(password, _dummy_hash())
        return False
    try:
        _, n, r, p, salt, expected = stored.split("$")
        digest = hashlib.scrypt(
            password.encode(), salt=bytes.fromhex(salt), n=int(n), r=int(r), p=int(p), dklen=32,
            maxmem=256 * 1024 * 1024,
        )
        return hmac.compare_digest(digest, bytes.fromhex(expected))
    except (ValueError, TypeError):
        return False


_dummy: str | None = None


def _dummy_hash() -> str:
    global _dummy
    if _dummy is None:
        _dummy = hash_password(secrets.token_hex(8))
    return _dummy


# ---- users ------------------------------------------------------------------------------------

def public_user(row) -> dict:
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "email_verified": bool(row["email_verified"]),
        "has_password": bool(row["password_hash"]),
        "google_linked": bool(row["google_sub"]),
        "created_at": row["created_at"],
    }


def get_user_by_email(email: str):
    with connect() as db:
        return db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()


def get_user(user_id: int):
    with connect() as db:
        return db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def create_user(email: str, password: str | None, name: str, verified: bool = False, google_sub: str | None = None):
    try:
        with connect() as db:
            cur = db.execute(
                "INSERT INTO users (email, name, password_hash, email_verified, google_sub, created_at) VALUES (?,?,?,?,?,?)",
                (email, name, hash_password(password) if password else None, int(verified), google_sub, _iso(_now())),
            )
            return db.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    except sqlite3.IntegrityError:
        raise AuthError("An account with this email already exists. Try logging in.", 409, "email") from None


def set_password(user_id: int, password: str) -> None:
    with connect() as db:
        db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(password), user_id))


def delete_user(user_id: int) -> None:
    with connect() as db:
        db.execute("DELETE FROM users WHERE id = ?", (user_id,))


# ---- sessions ---------------------------------------------------------------------------------

def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    now = _now()
    with connect() as db:
        db.execute("DELETE FROM sessions WHERE expires_at < ?", (_iso(now),))  # tidy up
        db.execute(
            "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)",
            (_sha(token), user_id, _iso(now), _iso(now + timedelta(days=SESSION_DAYS))),
        )
    return token


def user_for_session(token: str | None):
    if not token:
        return None
    with connect() as db:
        return db.execute(
            "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
            (_sha(token), _iso(_now())),
        ).fetchone()


def end_session(token: str | None) -> None:
    if token:
        with connect() as db:
            db.execute("DELETE FROM sessions WHERE token_hash = ?", (_sha(token),))


def end_other_sessions(user_id: int, keep_token: str | None = None) -> None:
    with connect() as db:
        db.execute("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?", (user_id, _sha(keep_token or "")))


# ---- one-time tokens (email verification, password reset) -------------------------------------

def create_token(user_id: int, kind: str, lifetime: timedelta) -> str:
    token = secrets.token_urlsafe(32)
    with connect() as db:
        db.execute("DELETE FROM tokens WHERE user_id = ? AND kind = ?", (user_id, kind))  # newest link only
        db.execute(
            "INSERT INTO tokens (token_hash, user_id, kind, expires_at) VALUES (?,?,?,?)",
            (_sha(token), user_id, kind, _iso(_now() + lifetime)),
        )
    return token


def use_token(token: str, kind: str) -> int:
    """Consume a token and return its user id, or raise AuthError. Single use."""
    bad = AuthError("This link is invalid or has expired. Request a new one.", 400, "token")
    if not isinstance(token, str) or not token:
        raise bad
    with connect() as db:
        row = db.execute(
            "SELECT user_id FROM tokens WHERE token_hash = ? AND kind = ? AND used_at IS NULL AND expires_at > ?",
            (_sha(token), kind, _iso(_now())),
        ).fetchone()
        if row is None:
            raise bad
        # The WHERE clause makes this atomic: only one concurrent request can win.
        cur = db.execute(
            "UPDATE tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL", (_iso(_now()), _sha(token))
        )
        if cur.rowcount != 1:
            raise bad
        return row["user_id"]


def mark_verified(user_id: int) -> None:
    with connect() as db:
        db.execute("UPDATE users SET email_verified = 1 WHERE id = ?", (user_id,))


# ---- Google accounts --------------------------------------------------------------------------

def sign_in_with_google(sub: str, email: str, name: str):
    """Find or create the user for a Google identity whose email Google has verified."""
    with connect() as db:
        row = db.execute("SELECT * FROM users WHERE google_sub = ?", (sub,)).fetchone()
        if row:
            return row
        row = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if row:
            if not row["email_verified"]:
                # Someone may have registered this address with a password they chose without owning
                # the mailbox. Google just proved ownership, so drop that password and its sessions.
                db.execute("UPDATE users SET password_hash = NULL WHERE id = ?", (row["id"],))
                db.execute("DELETE FROM sessions WHERE user_id = ?", (row["id"],))
            db.execute("UPDATE users SET google_sub = ?, email_verified = 1 WHERE id = ?", (sub, row["id"]))
            return db.execute("SELECT * FROM users WHERE id = ?", (row["id"],)).fetchone()
    return create_user(email, None, name or email.split("@")[0], verified=True, google_sub=sub)


# ---- throttling -------------------------------------------------------------------------------

class FailureThrottle:
    """Blocks a key after too many recent failures. In memory, per process."""

    def __init__(self, limit: int, window_s: float):
        self.limit, self.window_s = limit, window_s
        self._hits: dict[str, deque] = {}
        self._lock = threading.Lock()

    def _recent(self, key: str, now: float) -> deque:
        hits = self._hits.setdefault(key, deque())
        while hits and now - hits[0] >= self.window_s:
            hits.popleft()
        if not hits:
            self._hits.pop(key, None)
            return deque()
        return hits

    def retry_after(self, key: str) -> float:
        now = time.monotonic()
        with self._lock:
            hits = self._recent(key, now)
            return max(1.0, self.window_s - (now - hits[0])) if len(hits) >= self.limit else 0.0

    def fail(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            self._recent(key, now)
            self._hits.setdefault(key, deque()).append(now)

    def clear(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)


login_by_email = FailureThrottle(limit=5, window_s=15 * 60)
login_by_ip = FailureThrottle(limit=20, window_s=15 * 60)


def reset_throttles() -> None:
    for t in (login_by_email, login_by_ip):
        t._hits.clear()
