"""Outgoing email for verification and password-reset links.

With SMTP_HOST set, mail goes out over SMTP (STARTTLS on port 587 by default, or SSL on 465).
Without it the message is only written to the backend log, so you can develop without an email
account. That log line contains a live link: never run production without SMTP configured.
"""
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage

logger = logging.getLogger("spacesense.mail")


def frontend_url() -> str:
    return os.getenv("SPACESENSE_FRONTEND_URL", "http://localhost:5173").rstrip("/")


def configured() -> bool:
    return bool(os.getenv("SMTP_HOST", "").strip())


def send_email(to: str, subject: str, body: str) -> bool:
    """Send one plain-text email. Returns False (and logs) on failure; never raises."""
    host = os.getenv("SMTP_HOST", "").strip()
    if not host:
        logger.warning("SMTP is not configured. Email NOT sent. To: %s | Subject: %s\n%s", to, subject, body)
        return False
    port = int(os.getenv("SMTP_PORT", "587"))
    sender = os.getenv("SMTP_FROM", "").strip() or os.getenv("SMTP_USER", "").strip() or "no-reply@spacesense.local"
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = sender, to, subject
    msg.set_content(body)
    try:
        context = ssl.create_default_context()
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=15, context=context)
        else:
            server = smtplib.SMTP(host, port, timeout=15)
            server.starttls(context=context)
        with server:
            user, password = os.getenv("SMTP_USER", "").strip(), os.getenv("SMTP_PASSWORD", "")
            if user:
                server.login(user, password)
            server.send_message(msg)
        return True
    except (OSError, smtplib.SMTPException) as exc:
        logger.error("Could not send email to %s: %s: %s", to, type(exc).__name__, exc)
        return False


def send_verification(to: str, name: str, token: str) -> bool:
    link = f"{frontend_url()}/#/verify-email?token={token}"
    return send_email(
        to, "Confirm your SpaceSense email",
        f"Hi {name},\n\nConfirm your email address to finish setting up your SpaceSense account:\n\n{link}\n\n"
        "This link works once and expires in 24 hours. If you didn't create an account, ignore this email.\n",
    )


def send_password_reset(to: str, name: str, token: str) -> bool:
    link = f"{frontend_url()}/#/reset-password?token={token}"
    return send_email(
        to, "Reset your SpaceSense password",
        f"Hi {name},\n\nUse this link to choose a new password:\n\n{link}\n\n"
        "It works once and expires in 1 hour. If you didn't ask for this, ignore this email; "
        "your password has not changed.\n",
    )
