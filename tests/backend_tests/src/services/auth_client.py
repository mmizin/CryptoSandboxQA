"""
HTTP client for auth endpoints (aligned with tests/ui-tests/src/services/auth.api.ts).
"""

from __future__ import annotations

import os
from typing import Any, Optional

import httpx

from utils.env_loader import ensure_repo_env_loaded
from models import UserWithProfileTestData

from .base_client import BaseClient


def get_admin_api_key() -> str:
    ensure_repo_env_loaded()
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


class AuthClient(BaseClient):
    """Sync httpx wrapper for registration endpoints."""

    def __enter__(self) -> AuthClient:
        return self

    def register_with_profile(
        self,
        user: UserWithProfileTestData,
        *,
        expected_failure: bool = False,
    ) -> dict[str, Any] | httpx.Response:
        payload = registration_dict_from_test_data(user)
        return self.post(
            "/auth/register-with-profile",
            json=payload,
            expected_failure=expected_failure,
        )

    def create_admin(
        self,
        email: str,
        password: str,
        display_name: Optional[str],
        admin_api_key: str,
        *,
        expected_failure: bool = False,
    ) -> dict[str, Any] | httpx.Response:
        body: dict[str, Any] = {"email": email, "password": password}
        if display_name is not None:
            body["displayName"] = display_name
        return self.post(
            "/auth/admin/register",
            json=body,
            headers={"X-Admin-API-Key": admin_api_key},
            expected_failure=expected_failure,
        )
