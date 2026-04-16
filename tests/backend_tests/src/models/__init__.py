"""Domain types for backend API tests (mirrors tests/ui-tests/src/models layout)."""

from .trading import (
    CreateOrderRequest,
    Order,
    OrdersListMeta,
    OrdersListResponse,
)
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
    "CreateOrderRequest",
    "Order",
    "OrdersListMeta",
    "OrdersListResponse",
    "RegisteredTestUser",
    "UserProfile",
    "UserRole",
    "UserWithProfile",
    "UserWithProfileTestData",
    "admin_registered_test_user_from_auth_result",
    "registered_test_user_from_auth_result",
]
