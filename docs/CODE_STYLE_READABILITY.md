# Code style — readability and naming

This project uses small conventions so call sites stay easy to read, review, and debug—especially in tests and API client code.

## Principles

1. **Describe the role, not the container.** Prefer `fiat_deposit_request` or `create_order_body` over `payload` or `data` when the value has multiple fields or is used across several lines.
2. **Name non-trivial arguments.** Build request bodies, query maps, and similar objects in a **local variable**, then pass that variable into the function. That makes breakpoints, stack traces, and diffs clearer than inlined object literals in long calls.
3. **HTTP responses in tests and clients.** Prefer `response` for a raw `httpx.Response` (or browser `Response`) instead of `r`, especially if you assert status, call helpers with the body, or use the variable more than once. Use names like `raw` or a domain word (`created`) for **typed** successful parse results, consistent with the file.
4. **Reuse builders when they exist.** For complex shapes, use `DepositBuilder`, `UserBuilder`, `OrderBuilder`, or the UI test equivalents, then keep a **named** binding for the built value when it improves clarity.
5. **Assertion messages in tests.** On `assert` (or framework equivalents), add a **failure message** that says what the test expected, what it got, and—when the subject is an **HTTP** response—**status** and a **short body / error text** snippet so failed runs in CI are diagnosable without a local re-run. Use a small helper to format the response if it avoids repetition (see [templates](examples/code-style-templates.md)).

## When to apply

- **Apply:** multi-field JSON/objects, DTOs, query option bags, and anything you might inspect in a debugger.
- **Optional / case-by-case:** a single two-field literal on one line in a very small test where extracting a name adds noise without adding intent. Prefer consistency within the same file.

## Exceptions

- Single primitives or obvious one-offs do not need a separate variable for their own sake.
- Do not mass-reformat files only to satisfy this doc; adopt the style in **new** code and when **touching** existing code, unless a focused readability pass is agreed.

## Machine-readable rule and examples

- Cursor: [.cursor/rules/code-readability.mdc](../.cursor/rules/code-readability.mdc)
- Copy-paste templates: [docs/examples/code-style-templates.md](examples/code-style-templates.md)
