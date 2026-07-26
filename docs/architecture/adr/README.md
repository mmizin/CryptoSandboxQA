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
