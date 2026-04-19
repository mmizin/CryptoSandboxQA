# Map — testing by capability

**Purpose:** Cross-layer index: **capability → product code → Python API specs → API harness → Playwright specs → UI harness**. Use this when a feature spans **`tests/backend_tests/`** and **`tests/ui-tests/`** and the layout alone does not show the link.

**Canonical:** [`ARCHITECTURE.md`](../../../ARCHITECTURE.md) · Layer maps: [`map-tests-backend.md`](map-tests-backend.md), [`map-tests-ui.md`](map-tests-ui.md) · After moves or new suites, refresh via the [**update-knowledge**](../../../.cursor/commands/cmd-update-knowledge.md) playbook.

## How to extend

When you add or relocate coverage for a capability, **add or adjust one row** (and keep cells to **paths** or **—**, not long descriptions). If a row grows unwieldy, split a dedicated `map-testing-<slug>.md` and link it from here.

## Index

| Capability | Product (`backend/src/`) | API test specs (`tests/backend_tests/tests/`) | API harness | UI specs (`tests/ui-tests/tests/`) | UI harness |
|------------|--------------------------|--------------------------------------------------|-------------|-------------------------------------|------------|
| **Orders** | `orders/` | `tests/backend_tests/tests/api/test_orders_api_*.py`; `tests/backend_tests/tests/integration/test_orders_lifecycle.py` | `tests/backend_tests/src/services/orders_client.py`; `tests/backend_tests/src/models/trading/`; `tests/backend_tests/src/builders/order_builder.py`; `tests/backend_tests/src/factories/order_factory.py`; `tests/backend_tests/src/utils/order_api_helpers.py` | `tests/ui-tests/tests/e2e/tradeSpotOrders.spec.ts`; `tests/ui-tests/tests/e2e/tradeFuturesOrders.spec.ts`; `tests/ui-tests/tests/unit/tradeOrderValidation.spec.ts` | `tests/ui-tests/src/pages/trade.page.ts`; `tests/ui-tests/src/models/trading/order.types.ts`; `tests/ui-tests/src/models/trading/trade.types.ts` |
| **Deposits** | `deposits/` | — | `tests/backend_tests/src/services/deposits_client.py`; `tests/backend_tests/src/models/payments/deposit_models.py`; `tests/backend_tests/src/builders/deposit_builder.py`; `tests/backend_tests/src/factories/deposit_factory.py` | — | `tests/ui-tests/src/services/deposits.api.ts`; `tests/ui-tests/src/models/payments/deposit-withdrawal.types.ts` |
| **Login / session (UI)** | `auth/` | — | `tests/backend_tests/src/services/auth_client.py`; user plugins under `tests/backend_tests/src/plugins/users/` | `tests/ui-tests/tests/e2e/login.spec.ts`; `tests/ui-tests/tests/unit/loginInputFields.spec.ts`; `tests/ui-tests/tests/unit/loginInvalidCredentials.scenarios.ts` | `tests/ui-tests/src/pages/login.page.ts`; shared layout per [`map-tests-ui.md`](map-tests-ui.md) |

**Deposits — UI tests:** In the current working tree there is **no** Playwright file under `tests/ui-tests/tests/` that is **about deposits** (no dedicated deposit E2E/unit spec). Trade order specs may call the deposits HTTP API for setup; that stays on the **Orders** row, not here. If deposit UI specs exist on another branch, merge them and add paths above (or run **update-knowledge**).

## Related wiki

- [`00-START-HERE.md`](00-START-HERE.md)
- [`index-by-repo-path.md`](index-by-repo-path.md)
