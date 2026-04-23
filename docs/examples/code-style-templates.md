# Code style templates (readability)

Use these as patterns when writing or refactoring tests and clients. The full rules are in [../CODE_STYLE_READABILITY.md](../CODE_STYLE_READABILITY.md).

## Python (API tests / clients)

**Prefer** — name the request, then call:

```python
fiat_deposit_request = {"fiatCurrency": "USD", "amount": 100}
raw = user.api.deposits.deposit_fiat(fiat_deposit_request)
```

**Acceptable** for a tiny smoke line (optional extraction):

```python
raw = user.api.deposits.deposit_fiat({"fiatCurrency": "USD", "amount": 100})
```

**With a builder** — still use a name for the built dict when the call is non-trivial:

```python
request = deposit_builder.fiat_usd_card(amount=50).build()
raw = user.api.deposits.deposit_fiat(request)
```

## TypeScript (UI test services / API helpers)

**Prefer:**

```typescript
const body = { fiatCurrency: "USD", amount: 100 };
await userApi.deposits.depositFiat(body);
```

**With an explicit type** (when the project exposes one):

```typescript
const body: DepositFiatRequest = { fiatCurrency: "USD", amount: 100 };
await userApi.deposits.depositFiat(body);
```

**Failure / raw HTTP (e.g. `expected_failure=True`):** assign to `response`, not `r`:

```python
response = user.api.deposits.deposit_fiat(fiat_deposit_request, expected_failure=True)
assert isinstance(response, httpx.Response)
assert response.status_code == 400
```

**Success DTOs:** short names like `raw` or domain names (`created`, `listed`) are fine.

## Assertion messages (failed runs should be diagnosable)

In **Python API tests** under `tests/backend_tests/`, reuse [`utils/http_assertions.py`](../../tests/backend_tests/src/utils/http_assertions.py): `error_text_from_response`, `response_assert_detail`. [`order_api_helpers.assert_response_contains`](../../tests/backend_tests/src/utils/order_api_helpers.py) includes full response detail on failure.

**Python (pytest `assert`):** pass a string as the second argument. Include a **test-specific** context label and, for `httpx.Response`, status + message + body snippet (truncate long bodies).

```python
def _response_assert_detail(response: httpx.Response) -> str:
    snippet = (response.text or "")[:2000]
    return (
        f"status={response.status_code!r} "
        f"message={_error_text(response)!r} "
        f"body[:2000]={snippet!r}"
    )


assert response.status_code == 400, (
    f"bad_fiat_currency: expected HTTP 400; {_response_assert_detail(response)}"
)
err = _error_text(response)
assert "Invalid crypto symbol" in err, (
    f"deposit_invalid_symbol: expected error text; got {err!r}; {_response_assert_detail(response)}"
)
```

**Playwright / Vitest:** use `expect(value, "description")` or the matcher’s `message` / soft-message options as supported, with expected vs actual and URL or locator when it helps.

## Naming quick reference

| Instead of   | Prefer (examples)                    |
|-------------|--------------------------------------|
| `payload`   | `fiat_deposit_request`, `order_body` |
| `data`      | `registration_body`, `query`       |
| `r` (HTTP)  | `response` for `httpx.Response` / `Response` |
| `options`   | `list_transactions_options` (if many fields) |

Generic names are fine only in **very** small scopes where the type or the next line makes the meaning obvious.
