"""Domain types for backend API tests (mirrors tests/ui-tests/src/models layout)."""

from .user import (
    RegisteredTestUser,
    UserProfile,
    UserRole,
    UserWithProfile,
    UserWithProfileTestData,
    registered_test_user_from_auth_result,
)

__all__ = [
    "RegisteredTestUser",
    "UserProfile",
    "UserRole",
    "UserWithProfile",
    "UserWithProfileTestData",
    "registered_test_user_from_auth_result",
]
