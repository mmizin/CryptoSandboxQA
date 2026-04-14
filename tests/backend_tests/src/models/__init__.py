"""Domain types for backend API tests (mirrors tests/ui-tests/src/models layout)."""

from .user import UserProfile, UserRole, UserWithProfile, UserWithProfileTestData

__all__ = [
    "UserProfile",
    "UserRole",
    "UserWithProfile",
    "UserWithProfileTestData",
]
