"""
HTTP client for auth endpoints (aligned with tests/ui-tests/src/services/auth.api.ts).
"""

from __future__ import annotations

import os
from dataclasses import asdict
from datetime import datetime
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
    """JSON body for POST /auth/register-with-profile (omit Nones; keep email/password)."""
    raw = asdict(user)
    out: dict[str, Any] = {}
    for key, value in raw.items():
        if value is None:
            continue
        if isinstance(value, datetime):
            out[key] = value.isoformat()
        else:
            out[key] = value
    out["email"] = user.email
    out["password"] = user.password
    return out


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
        response.raise_for_status()
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
        response.raise_for_status()
        return response.json()
