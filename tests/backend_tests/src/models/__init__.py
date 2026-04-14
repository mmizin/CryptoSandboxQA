"""Domain types for backend API tests (mirrors tests/ui-tests/src/models layout)."""

from .user import (
    AdminRegisteredTestUser,
    RegisteredTestUser,
    UserProfile,
    UserRole,
    UserWithProfile,
    UserWithProfileTestData,
    admin_registered_test_user_from_auth_result,
    registered_test_user_from_auth_result,
)

__all__ = [
    "AdminRegisteredTestUser",
    "RegisteredTestUser",
    "UserProfile",
    "UserRole",
    "UserWithProfile",
    "UserWithProfileTestData",
    "admin_registered_test_user_from_auth_result",
    "registered_test_user_from_auth_result",
]
