"""
HTTP client for auth endpoints (aligned with tests/ui-tests/src/services/auth.api.ts).
"""

from __future__ import annotations

import os
from typing import Any, Optional

import httpx

from models.user.user_types import UserWithProfileTestData


def get_api_url() -> str:
    """Same resolution order as Playwright BaseApi.getApiUrl."""
    url = os.environ.get("API_URL", "").strip() or os.environ.get("NEXT_PUBLIC_API_URL", "").strip()
    if not url:
        raise RuntimeError("API_URL or NEXT_PUBLIC_API_URL is not set")
    return url.rstrip("/")


def get_admin_api_key() -> str:
    key = os.environ.get("ADMIN_API_KEY", "").strip()
    if not key:
        raise RuntimeError("ADMIN_API_KEY is not set")
    return key


def registration_dict_from_test_data(user: UserWithProfileTestData) -> dict[str, Any]:
    """
    JSON body for POST /auth/register-with-profile.

    Matches backend ``RegisterWithProfileDto`` (camelCase): only registration/profile fields;
    post-auth-only keys on ``UserWithProfileTestData`` (``id``, ``emailVerifiedAt``, ``createdAt``,
    ``updatedAt``, ``profile``) are not sent.
    """
    # Same field set as tests/ui-tests registerUserWithProfile payload / Nest RegisterWithProfileDto
    candidates: dict[str, Any] = {
        "email": user.email,
        "password": user.password,
        "displayName": user.displayName,
        "username": user.username,
        "fullName": user.fullName,
        "photoUrl": user.photoUrl,
        "bio": user.bio,
        "websiteUrl": user.websiteUrl,
        "location": user.location,
        "birthday": user.birthday,
        "languageCode": user.languageCode,
        "timezone": user.timezone,
        "preferences": user.preferences,
    }
    out: dict[str, Any] = {}
    for key, value in candidates.items():
        if key in ("email", "password"):
            out[key] = value
        elif value is not None:
            out[key] = value
    return out


def raise_for_status_with_body(response: httpx.Response) -> None:
    """
    Like ``response.raise_for_status()`` but include a truncated response body in the error
    message for 4xx/5xx (helps debug validation and server errors).
    """
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as e:
        snippet = ""
        try:
            snippet = (e.response.text or "")[:4000]
        except Exception:
            snippet = "<unreadable body>"
        msg = f"{e.request.method} {e.request.url} -> {e.response.status_code}\n{snippet}"
        raise httpx.HTTPStatusError(msg, request=e.request, response=e.response) from e


class AuthClient:
    """Sync httpx wrapper for registration endpoints."""

    def __init__(self, base_url: str | None = None, *, client: httpx.Client | None = None) -> None:
        self._base_url = (base_url or get_api_url()).rstrip("/")
        self._owns_client = client is None
        self._client = client or httpx.Client(base_url=self._base_url, timeout=30.0)

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> AuthClient:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    def register_with_profile(self, user: UserWithProfileTestData) -> dict[str, Any]:
        payload = registration_dict_from_test_data(user)
        response = self._client.post("/auth/register-with-profile", json=payload)
        raise_for_status_with_body(response)
        return response.json()

    def create_admin(
        self,
        email: str,
        password: str,
        display_name: Optional[str],
        admin_api_key: str,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"email": email, "password": password}
        if display_name is not None:
            body["displayName"] = display_name
        response = self._client.post(
            "/auth/admin/register",
            json=body,
            headers={"X-Admin-API-Key": admin_api_key},
        )
        raise_for_status_with_body(response)
        return response.json()
