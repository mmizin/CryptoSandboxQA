# Architecture Decision Records

ADRs produced under the documentation implementation effort
(`DOCUMENTATION_IMPLEMENTATION_PLAN.md`), owned by
`architecture-toolkit:adr-expert`. This is the **active ADR baseline**,
rebuilt from scratch using the `architecture-toolkit` workflow and template
(Decision Drivers / Assumptions / Considered Options / Risks).

Numbering continues sequentially from the pre-existing collection at
[`docs/architecture/history/legacy-adr/`](../history/legacy-adr/)
(0001-0007), but that collection is a **historical archive only** — it uses
an older MADR-lite format, is not maintained, and is not part of this
baseline. Do not follow its format/workflow conventions for new ADRs; follow
`architecture-toolkit:adr-expert`'s template instead.

## Current decisions

| # | Title | Status |
|---|-------|--------|
| [0008](./0008-duplicate-email-registration-race-handling.md) | Handle duplicate-email registration races via a `UsersService`-scoped constraint translation | Accepted |
| [0009](./0009-notification-delivery-boundary-on-request-path.md) | Bound outbound notification delivery instead of leaving it unbounded on the request path | Accepted |
| [0010](./0010-session-revocation-via-db-backed-session-records.md) | Gate access on a server-side session record, not on JWT validity alone | Accepted |
| [0011](./0011-end-impersonation-authentication-boundary.md) | Authenticate the end-impersonation restore path with a guard, single-use enforcement, and impersonated-token binding | Proposed |
| [0012](./0012-decouple-password-reset-code-pepper-from-jwt-secret.md) | Decouple the password-reset code pepper from `JWT_SECRET`, keep a hardcoded final default | Accepted |
| [0013](./0013-rate-limiting-for-unauthenticated-auth-endpoints.md) | Rate-limit unauthenticated auth-adjacent endpoints, and close the password-reset code invalidation race with a schema-enforced unique constraint and a fail-safe conflict guard | Accepted |
| [0014](./0014-session-revocation-on-2fa-enrollment.md) | Revoke other existing sessions when 2FA is enabled on an account, preserving the enrolling session | Accepted |
| [0015](./0015-step-up-authentication-for-2fa-enrollment.md) | Require password re-verification (step-up authentication) before enabling 2FA | Accepted |
