"""
Fluent builder for user test payloads. Aligned with tests/ui-tests/src/builders/user.builder.ts.
"""

from __future__ import annotations

import random
import string
import time
from typing import Any, Optional

from models.user.user_types import UserWithProfileTestData


def unique_email(prefix: str = "user") -> str:
    frag = "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(8))
    suffix = f"{int(time.time() * 1000)}-{frag}"
    return f"{prefix}-{suffix}@test.com"


class UserBuilder:
    def __init__(self) -> None:
        self._data: dict[str, Any] = {
            "email": unique_email(),
            "password": "TestPassword123!",
            "displayName": "Test User",
            "username": "testuser",
            "fullName": "Test User Full",
            "photoUrl": "https://example.com/photo.jpg",
            "bio": "Crypto enthusiast",
            "websiteUrl": "https://example.com",
            "location": "New York",
            "birthday": "1990-01-15",
            "languageCode": "en",
            "timezone": "America/New_York",
            "preferences": {"theme": "dark", "notifications": True},
        }

    def with_email(self, email: str) -> UserBuilder:
        self._data["email"] = email
        return self

    def with_unique_email(self) -> UserBuilder:
        self._data["email"] = unique_email("unique")
        return self

    def with_password(self, password: str) -> UserBuilder:
        self._data["password"] = password
        return self

    def with_display_name(self, display_name: Optional[str]) -> UserBuilder:
        self._data["displayName"] = display_name
        return self

    def with_username(self, username: Optional[str]) -> UserBuilder:
        self._data["username"] = username
        return self

    def with_full_name(self, full_name: Optional[str]) -> UserBuilder:
        self._data["fullName"] = full_name
        return self

    def with_photo_url(self, photo_url: Optional[str]) -> UserBuilder:
        self._data["photoUrl"] = photo_url
        return self

    def with_bio(self, bio: Optional[str]) -> UserBuilder:
        self._data["bio"] = bio
        return self

    def with_website_url(self, website_url: Optional[str]) -> UserBuilder:
        self._data["websiteUrl"] = website_url
        return self

    def with_location(self, location: Optional[str]) -> UserBuilder:
        self._data["location"] = location
        return self

    def with_birthday(self, birthday: Optional[str]) -> UserBuilder:
        self._data["birthday"] = birthday
        return self

    def with_language_code(self, language_code: Optional[str]) -> UserBuilder:
        self._data["languageCode"] = language_code
        return self

    def with_timezone(self, timezone: Optional[str]) -> UserBuilder:
        self._data["timezone"] = timezone
        return self

    def with_preferences(self, preferences: Optional[dict[str, Any]]) -> UserBuilder:
        self._data["preferences"] = preferences
        return self

    def required(self) -> UserBuilder:
        self._data = {
            "email": unique_email("minimal"),
            "password": "TestPassword123!",
            "displayName": "Minimal User",
        }
        return self

    def build(self) -> UserWithProfileTestData:
        d = self._data
        return UserWithProfileTestData(
            email=d["email"],
            password=d["password"],
            displayName=d.get("displayName"),
            photoUrl=d.get("photoUrl"),
            username=d.get("username"),
            bio=d.get("bio"),
            fullName=d.get("fullName"),
            websiteUrl=d.get("websiteUrl"),
            location=d.get("location"),
            birthday=d.get("birthday"),
            languageCode=d.get("languageCode"),
            timezone=d.get("timezone"),
            preferences=d.get("preferences"),
            id=d.get("id"),
            emailVerifiedAt=d.get("emailVerifiedAt"),
            createdAt=d.get("createdAt"),
            updatedAt=d.get("updatedAt"),
            profile=d.get("profile"),
        )
