"""
User shapes aligned with GET /users/me and related APIs (camelCase JSON).

Mirrors tests/ui-tests/src/models/user/user.types.ts.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal, Optional

UserRole = Literal["user", "admin"]


@dataclass
class UserProfile:
    id: str
    userId: str
    photoUrl: Optional[str]
    username: Optional[str]
    bio: Optional[str]
    fullName: Optional[str]
    websiteUrl: Optional[str]
    location: Optional[str]
    birthday: Optional[str]
    languageCode: str
    timezone: str
    preferences: dict[str, Any]
    verificationStatus: str
    createdAt: str
    updatedAt: str


@dataclass
class UserWithProfile:
    id: str
    email: str
    displayName: Optional[str]
    role: UserRole
    emailVerifiedAt: Optional[str]
    createdAt: str
    updatedAt: str
    profile: Optional[UserProfile]


@dataclass
class UserWithProfileTestData:
    """Registration/login credentials, optional profile fields, optional post-auth fields."""

    email: str
    password: str
    displayName: Optional[str] = None
    photoUrl: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    fullName: Optional[str] = None
    websiteUrl: Optional[str] = None
    location: Optional[str] = None
    birthday: Optional[str] = None
    languageCode: Optional[str] = None
    timezone: Optional[str] = None
    preferences: Optional[dict[str, Any]] = None
    id: Optional[str] = None
    emailVerifiedAt: Optional[datetime] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    profile: Optional[Any] = None
