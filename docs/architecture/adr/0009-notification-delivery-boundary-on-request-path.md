# Bound outbound notification delivery instead of leaving it unbounded on the request path

**Status:** Accepted

**Date:** 2026-07-25
**Revision 1:** 2026-07-25 — reworked after `architecture-reviewer` found
the original Context overstated an existing guarantee and the Decision
overstated what the chosen timeouts bound. See
`docs/architecture/findings/ARCHITECTURE-REVIEW-FINDINGS.md`
(FINDING-0004, FINDING-0005) for the full findings that revision resolved.
**Revision 2:** 2026-07-25 — re-review found the Revision 1 fix still
overclaimed the anti-enumeration guarantee (a timing oracle survives) and
never evaluated moving the failure-handling guarantee into `deliver()`
itself, which would make it structural instead of per-method. See
FINDING-0013, FINDING-0014.
**Revision 3:** 2026-07-25 — a third review found the Revision 2 fix
attached its own secret-logging safety rule to a catch clause that Option
D's adoption had just deleted (the rule needed to move to `deliver()`
itself, the one place that actually has the reset code in scope), and
found that Option B's rejection was never re-examined after Option D
neutralized its stated objections. **This revision changes the Decision**
(adds Option B narrowly for `sendPasswordResetCode`) — unlike a purely
editorial pass, this is a new mechanism, verified against
`requestPasswordReset()`'s actual implementation before adoption. See
FINDING-0016, FINDING-0017.
**Revision 4:** 2026-07-25 — a fourth review pass confirmed both adopted
mechanisms (A+D composing correctly; the narrow B application being safe
given `requestPasswordReset()`'s actual control flow) and found only
claim-scoping and cross-reference issues: a stale section still describing
pre-Revision-3 behavior, an unqualified rejection of Option B twenty lines
after adopting it narrowly, an overclaim that the timing oracle is fully
closed (a smaller DB-only residual remains), an unstated requirement that
the `deliver()` catch must enclose transport construction, and an
unstated cost (Mailpit-visible-on-response determinism, given up for
password reset specifically). Editorial and claim-scoping only — no
further re-decision. Reviewer's explicit recommendation: this ADR is
ready for `Status: Accepted` once these land; a fifth review pass is not
expected to find anything that changes the decision.

## Context

`MailService.deliver()` builds a `nodemailer` transport per call
(`mail.service.ts`) with no `connectionTimeout`, `greetingTimeout`, or
`socketTimeout` configured. Every notification-sending method on
`MailService` (`sendWelcomeEmail`, `sendOrderStatusEmail`,
`sendDepositFiatEmail`, `sendDepositCryptoEmail`,
`sendPasswordResetCode`) is `await`ed synchronously by its caller — this is
not specific to registration: `AuthService`, `OrdersService`/
`MatchingService`, `DepositsService`, and `WalletsService` all do it the
same way. There is no queue, worker, or outbox anywhere in this codebase
(`package.json` has no `bull`/`bullmq`/equivalent).

**Correction to the original draft:** the claim that "a failed send never
fails the caller's request" does not hold for all five methods.
`sendWelcomeEmail`, `sendOrderStatusEmail`, `sendDepositFiatEmail`, and
`sendDepositCryptoEmail` each wrap their body in try/catch and log-and-swallow
any error. **`sendPasswordResetCode` does not** — it has no try/catch
(`mail.service.ts:53-60`), and its caller,
`AuthService.requestPasswordReset()`, awaits it unguarded
(`auth.service.ts:109`). That method's own comment states its purpose:
*"Same response whether or not the email exists (avoid account
enumeration)."* It returns the same generic message early when no account
is found, and only reaches the mail call when the account **does** exist.
So today, a hard SMTP failure on that one path already produces a
different outward result (an unhandled error) depending on whether the
email exists — a pre-existing gap this ADR must not widen. See "Bringing
`sendPasswordResetCode` in scope" below.

**Slowness is not handled by any of the five methods.** If the configured
SMTP host accepts a TCP connection but stalls (does not error, does not
respond), the `await` has no code-level upper bound and will hold the
caller's request open for however long Node's/the OS's default socket
behavior allows — materially longer than any request should reasonably
wait.

`PRD-Registration` (`docs/features/registration/PRD.md`, Q-005, FC-003)
raised this specifically for the welcome email, but the same code path
(`MailService.deliver`) is shared by every notification in the system —
today, that's the five methods named above, all already implemented and
in production use (order status, deposit receipts ×2, welcome, password
reset). Phase 7 of the documentation plan (`DOCUMENTATION_IMPLEMENTATION_PLAN.md`)
covers *documenting* these existing features plus one genuinely new one
(training credit deposit email), not five new email features — the
"and growing" premise for this ADR's blast-radius reasoning rests on the
five existing callers already sharing this code path today, which is
sufficient on its own; it does not need the Phase 7 count inflated to
justify treating this as an app-wide decision. Whatever this ADR decides
applies to all current callers, and to training credit once it's built.

## Decision Drivers

- **Reliability of the request path** — an unbounded external I/O call
  inside a request handler is a latent availability risk (holds a request
  thread/connection for an unbounded duration under a specific failure
  mode).
- **Security: no new account-enumeration side channel.** All password-reset
  email paths must produce the same caller-visible response regardless of
  whether the target email exists. This decision must not turn a rare
  failure mode (SMTP down) into a common one (SMTP slow) on that specific
  path — see FINDING-0004.
- **Honesty about what a timeout actually bounds.** The Decision must state
  the real guarantee nodemailer's timeout options provide, not a stronger
  one — see FINDING-0005.
- **Blast radius / precedent** — this is the only outbound-notification
  mechanism in the codebase and every current and planned notification
  feature routes through it; the decision made here is the decision made
  for all of Phase 7, not just registration.
- **No existing infrastructure to build on** — there is no queue or worker
  process anywhere in this deployment today; any option that assumes one
  is introducing a new infrastructure category, not extending an existing
  one.
- **Minimal disruption to a training sandbox** — this is a QA training
  tool, not a production financial system; the fix should be proportionate
  to that context, not over-engineered for throughput this app will never
  see.

## Assumptions

- Registration/order/deposit request volume in this sandbox is low; this
  decision is driven by the *failure mode* (an unresponsive SMTP host), not
  by throughput.
- Mailpit (the documented local SMTP mock, `CLAUDE.md`) and typical SMTP
  providers both respond quickly under normal operation — the risk this
  ADR addresses is specifically host unavailability/hang, not routine
  latency.

## Considered Options

### Option A — Add explicit timeouts to the existing synchronous call

Set `connectionTimeout`, `greetingTimeout`, and `socketTimeout` on the
`nodemailer.createTransport()` call in `MailService.deliver()`. No change
to call sites — mail sending stays `await`ed on the request path, now with
an upper bound.

- **Advantages:** Smallest possible change, one file. Preserves today's
  guarantee that a mail failure (now including "timed out") is logged
  before the caller's request completes. No new infrastructure.
- **Disadvantages:** Every request that sends a notification still pays
  the round-trip latency of a live SMTP call, up to the timeout, before
  responding — bounded, but still synchronous and still on the critical
  path of unrelated business operations (registration, order fills,
  deposits).
- **Risks:** Choosing too aggressive a timeout produces false failures
  against a slow-but-working host; choosing too generous a timeout barely
  improves on today's unbounded wait. The right value isn't derivable from
  anything in this codebase and would need to be picked, not discovered.

### Option B — Fire-and-forget the mail call (don't `await` it in the request path)

Call `mailService.send*Email(...)` without awaiting it from the business
logic; let it resolve or reject independently of the response.

- **Advantages:** Removes mail latency from the response path entirely
  with no new infrastructure.
- **Disadvantages:** Breaks the existing guarantee that a failed/slow send
  is logged synchronously before the request completes — an unhandled
  promise rejection needs its own handling (e.g. `process.on
  ('unhandledRejection')` or explicit `.catch()` at each call site) to
  preserve today's "log every failure" behavior. Order of operations
  becomes harder to reason about (e.g. a welcome email could in principle
  attempt to send after the process has moved on to unrelated work).
- **Risks:** If the `.catch()` discipline isn't applied at every one of the
  5+ call sites (mirrors the same repeat-at-every-site risk as ADR-0008's
  Option B), an unhandled rejection could surface as a process-level
  warning or, depending on Node version/config, a crash.

### Option C — Move notification triggering off the request path via a queue/outbox

Introduce a persistent queue (or an outbox table polled by a worker) so
the request only records "a welcome email should be sent" and returns;
actual delivery happens asynchronously and independently.

- **Advantages:** Fully decouples request latency from mail delivery
  reliability; standard pattern for exactly this problem; would also give
  retry semantics this codebase has never had for notifications.
- **Disadvantages:** Introduces an entirely new infrastructure category
  (queue or outbox + worker) that does not exist anywhere in this
  deployment today, for a QA training sandbox where notification
  reliability is not a stated requirement anywhere in the PRD or the
  inventory.
- **Risks:** Disproportionate to the problem at this project's current
  scale — the largest engineering cost of the three options, applied to a
  training tool, not a production system with an SLA on notification
  delivery.

### Option D — Move the catch-and-log guarantee into `deliver()` itself, instead of repeating it per method

*(Added in Revision 2 — re-review found this alternative was never
evaluated, even though it directly addresses the same whitelist-drift
pattern ADR-0008 was reworked twice over.)*

Instead of each `send*Email` method wrapping its own call to `deliver()`
in try/catch, move the catch (and the timeout from Option A) inside
`deliver()` itself, so "a failure here is logged and never propagates" is
a property of the shared method every notification already goes through,
not a convention every caller has to remember to apply.

- **Advantages:** Structurally closes the exact gap `sendPasswordResetCode`
  is proof of — a method that shares `deliver()` but forgot the wrapper.
  One change point instead of five (soon more, per Phase 7) for the
  "failure/timeout doesn't leak past the mail layer" guarantee
  specifically. Directly addresses FINDING-0004's root cause rather than
  its one known instance.
- **Disadvantages:** Callers lose the ability to make delivery failure
  *fail their own request* if a future notification type legitimately
  needs that (none do today, but the current per-method structure allows
  it method-by-method; a shared `deliver()`-level swallow forecloses it
  uniformly unless deliberately special-cased back out). Slightly larger
  diff than Option A alone, since it touches the shared method's contract,
  not just its transport config.
- **Risks:** If a genuinely fatal mail failure ever needs to surface to a
  caller (not true for any of the 5 current methods), this option would
  need an opt-out mechanism that doesn't exist yet.

## Decision

**Option A combined with Option D, plus Option B narrowly for
`sendPasswordResetCode`** — add explicit `connectionTimeout`,
`greetingTimeout`, and `socketTimeout` to `MailService.deliver()`'s
`nodemailer` transport (A); move the catch-and-log wrapper from being
repeated in each `send*Email` method into `deliver()` itself, so "a
failure or timeout here is logged and never propagates" becomes a property
of the one shared method every notification goes through (D); and, because
D makes `deliver()` itself effectively non-rejecting, additionally stop
`awaiting` the one call whose synchronous wait creates a security-relevant
timing channel — `requestPasswordReset()`'s call to
`sendPasswordResetCode()` (B, applied narrowly). The other four methods
stay synchronous and `await`ed, deliberately (see "Re-evaluating Option B
under the adopted A+D combination" below).

Adding Option D to the decision, not just Option A, is a direct response
to re-review: the per-method version of this guarantee is a whitelist with
the same drift risk ADR-0008 needed two revisions to close, and
`sendPasswordResetCode` is the existence proof that the whitelist already
drifted once. No current caller needs a mail failure to fail its own
request (verified: all 5 either already swallow or, per this ADR, now
must), so Option D's only real disadvantage — foreclosing that per-caller
choice — costs nothing today and is called out as the thing to revisit if
a future notification genuinely needs it.

Chosen over Option C because introducing queue infrastructure for a
training sandbox with no stated notification-reliability requirement is
disproportionate — nothing in `PRD-Registration` or the feature inventory
asks for retry semantics or delivery guarantees, only that a slow/failed
send not block the response indefinitely. Chosen over Option B **applied
to all five methods** because it would silently weaken the existing
"every failure is logged" guarantee unless the same discipline (explicit
`.catch()` per call site) is applied everywhere — at which point it is
roughly the same implementation effort as Option A for a smaller
improvement, since it bounds nothing; a hung connection under Option B
still ties up a socket/handle, just not the request. (Option B is not
rejected in full — see "Re-evaluating Option B" below for where it is
adopted narrowly.)

The specific timeout values are an implementation detail for whoever picks
them up, not part of this decision — no benchmark or SLA in this codebase
determines a "correct" number.

### What the chosen timeouts actually bound — correcting a claim from the first draft

The original draft claimed this produces "a bounded worst case instead of
an unbounded one," without qualification. That overstates it.
`connectionTimeout` and `socketTimeout` bound the specific failure mode
this ADR was written to address: **a host that accepts a TCP connection
and then goes fully idle, never sending another byte.** They do **not**
bound everything that could go wrong:

- **DNS resolution** happens before `connectionTimeout` starts counting; a
  hanging DNS lookup is not covered by any of the three options.
- **`socketTimeout` is an inactivity timer, not a wall-clock deadline.** A
  host that sends occasional bytes (e.g. a keepalive) without ever
  completing the SMTP transaction resets the timer indefinitely and would
  still hang the request under this decision.

Closing those two gaps would require an outer wall-clock deadline around
the whole `deliver()` call (e.g. `Promise.race` against a fixed timer, or
`AbortSignal.timeout`). That is **not part of this decision** — it's a
named follow-up if the DNS-hang or periodic-keepalive cases turn out to
matter in practice. This ADR bounds the failure mode it set out to bound,
and no more; the Consequences and Risks sections below state the gap
explicitly rather than implying full coverage.

### Bringing `sendPasswordResetCode` in scope

The original draft treated all five `send*Email` methods as already
sharing the same "failure never reaches the caller" guarantee and left
`sendPasswordResetCode` no different from the rest. It is different today
(see Context), and this decision does not get to rely on a uniform
guarantee that doesn't yet exist. **`sendPasswordResetCode` is brought in
scope of this ADR**, not deferred: with the catch-and-log guarantee now
living inside `deliver()` itself (Option D, see Decision), this is no
longer a matter of remembering to add a wrapper at this one call site —
`sendPasswordResetCode` gets the guarantee automatically, the same as
every other caller of `deliver()`, once implemented. A timeout (or any
other delivery failure) on that path is logged internally but never
changes the response *content or status* `requestPasswordReset()` returns
to the caller. This is treated as a hard constraint this decision must not
violate — not an acceptable follow-up gap, because the whole point of that
method's existing design is to prevent account enumeration, and this ADR
would otherwise make that guarantee strictly worse (turning a rare failure
mode into a common one).

**Historical note (superseded by "Re-evaluating Option B" below — kept for
the reasoning trail, not as current guidance).** An earlier draft of this
ADR adopted only Option A for `sendPasswordResetCode`, which meant
wrapping the send in try/catch equalized response **content and status
code** between known and unknown email, but not **timing**: the known-email
path still ran a live SMTP round trip before responding (present under
normal operation, not only the stalled-host failure mode — a timeout could
only narrow that gap, not close it), while the unknown-email path returned
immediately. That gap is what motivated re-examining Option B below, which
this ADR's actual Decision adopts. Do not read this paragraph as
describing current behavior.

### Re-evaluating Option B under the adopted A+D combination

*(Added in Revision 3 — re-review found Option B's rejection, below, was
argued using objections that Option D's adoption had already neutralized,
and that the composition closing this ADR's one open security residual
was never evaluated.)*

Option B (fire-and-forget: don't `await` the mail send) was rejected below
on two grounds: it weakens the failure-logging guarantee unless
`.catch()` discipline is replicated at every call site, and it bounds
nothing. Both objections assumed Option B stood alone. Under the adopted
Option A+D, neither holds for `deliver()`'s callers generally: with the
catch living inside `deliver()` (D) and the transport timeout in place
(A), `deliver()` itself never rejects — there is no unhandled promise for
a caller who doesn't `await` it to leak. Fire-and-forget stops being
risky once the thing being fired-and-forgotten cannot reject.

This changes the calculus specifically for `requestPasswordReset()`,
whose password-reset send is the one call in this codebase with a stated
anti-enumeration requirement the timing oracle above violates. **This
decision therefore adds Option B, narrowly, for that one call site:**
`AuthService.requestPasswordReset()` does not `await` its call to
`sendPasswordResetCode()`. Combined with A+D, this removes the dominant
component of the timing oracle for password reset — the live SMTP round
trip, by far the largest single latency contributor — from the
known-email path's response time.

**This narrows the oracle by orders of magnitude; it does not fully close
it.** `requestPasswordReset()` (`auth.service.ts:109-140`) still performs
two database round trips exclusive to the known-email path before
responding — `userPasswordReset.deleteMany` (line 121) and
`userPasswordReset.create` (line 130), plus an HMAC hash of the code
(line 126) — none of which the unknown-email path does. A precise timing
attack could in principle still distinguish "a few milliseconds of DB
work" from "effectively zero." This residual is accepted as reasonable
for a QA-training sandbox rather than treated as fully closed — stating it
explicitly here after two prior revisions corrected overclaims about what
this ADR bounds, rather than repeating that pattern a third time.

**Not extended to the other four methods, deliberately.** None of
`sendWelcomeEmail`, `sendOrderStatusEmail`, `sendDepositFiatEmail`, or
`sendDepositCryptoEmail` carry an anti-enumeration or other
timing-sensitive requirement — there is no channel to close for them, and
keeping them synchronous has a real, if minor, benefit this ADR didn't
have occasion to state until now: a QA trainee interacting with Mailpit
(the documented local SMTP mock) sees the welcome/order/deposit email
already present the moment the triggering action's response returns,
which is a determinism property worth keeping for a *training* tool
where "go check your inbox" is part of the exercise. Applying B
everywhere would trade that away for no corresponding security benefit.
This is a scoped, reasoned exception to Option A+D's synchronous default,
not a return to blanket fire-and-forget — Option B as originally described
(applied to all 5 methods) remains rejected below for the reasons stated.

**Revision 3 correction: this safety rule was attached to the wrong
place.** Revision 2 stated it against "`sendPasswordResetCode`'s new catch
clause" — but under Option D, that clause doesn't exist; the catch lives
inside `deliver()` itself, which is the one function in this file that has
`text` (the full message body, including the reset code) as a local
variable, four lines below the pre-existing full-body log this ADR already
names as FINDING-0010. The most natural implementation of "log what failed
to send" inside `deliver()` is to log `text` — which would leak the reset
code on every failure, the exact outcome this rule exists to prevent.
Restated at the correct location: **the catch inside `deliver()` must log
only `to`, `subject`, and the caught error's `message`/`code` fields**
(nodemailer send errors carry `response`/`command`/`code` — not the
message body); it must never log `text` under any circumstances, for any
of the five current callers, not only for `sendPasswordResetCode`. Stated
at this level of specificity — naming the exact fields, not "log the
error" — because "safe by construction" should be a property of what the
code is required to log, not a property that happens to hold because
nodemailer's error shape doesn't currently embed the payload (a
dependency, not a guarantee, if left unstated).

**Equally specific about what the catch must enclose, not only what it may
log.** `deliver()` has code that can throw before `sendMail` is ever
called — `Number(SMTP_PORT ?? ...)` and `nodemailer.createTransport(...)`
both run first (`mail.service.ts:26-28, 38-43`). A catch wrapping only the
`sendMail` await would leave those paths unguarded, silently reopening the
propagation risk this whole decision exists to close. **The catch must
wrap the entire body of `deliver()` — transport construction included —
not only the `sendMail` call.**

**A separate, pre-existing secret-logging risk in the same file — not
introduced by this ADR, but adjacent enough to name.** `deliver()`'s
no-SMTP-host fallback (`mail.service.ts:31`) logs the **entire message
body** — `this.logger.log(...To: ${to}\nSubject: ${subject}\n${text}...)`
— which for `sendPasswordResetCode` includes the reset code in plaintext.
This is documented, intentional behavior for local development without
SMTP configured (`CLAUDE.md`: "MailService logs message body to backend
terminal instead of sending"), and it applies identically to every
notification type, not something this ADR's timeout change touches or
changes. It is named here rather than left silent because "is the logging
path safe" is exactly the question this ADR's own new catch clause had to
answer, and the honest answer for the adjacent, pre-existing fallback path
is: only as safe as wherever that log output is captured or retained. Not
fixed by this decision — recorded as FINDING-0010 for a separate,
explicit decision on whether local-dev convenience should keep taking that
trade-off.

## Consequences

### Positive

- Closes the specific failure mode Q-005 raised — a full-idle SMTP host can
  no longer hold a registration (or order/deposit) request open
  indefinitely — for the well-defined subset of hangs described above.
- Brings `sendPasswordResetCode` up to the same failure-handling standard
  as the other four methods, closing a pre-existing (not newly introduced)
  content/status account-enumeration gap on that path as part of this
  change, rather than leaving it as a separate follow-up.
- With the guarantee moved into `deliver()` (Option D), it applies to
  every current and future notification **structurally**, not by
  convention — no future `send*Email` method can forget the wrapper,
  because there is no per-method wrapper to forget. This directly closes
  the drift pattern `sendPasswordResetCode` was proof of, rather than
  papering over one instance of it.
- No new infrastructure, no new operational surface to run or monitor.
- The `deliver()`-level catch (Option D) is required to log only `to`,
  `subject`, and the error's `message`/`code` — verified never to include
  `text` — so this decision does not add a new secret-logging surface even
  though it now governs the one method in the file that carries a secret.
- **Removes the dominant component of the password-reset timing oracle,**
  not just the content oracle. Revision 2 left this open; Revision 3
  removes the live SMTP round trip from the known-email path by not
  awaiting `sendPasswordResetCode()`'s call specifically, made safe only
  because Option D already made `deliver()` non-rejecting for that caller.
  A smaller residual (two DB round trips exclusive to the known-email
  path) remains — see "This narrows the oracle... it does not fully close
  it" above and the Risks entry below; not claimed as fully closed.

### Negative

- Requests that trigger the four remaining synchronous notifications still
  pay live SMTP latency (bounded for the target failure mode, not zero)
  before responding — this does not remove mail from the critical path for
  those methods, only caps how bad the targeted failure mode can get. This
  is a deliberate, stated trade-off for those four (see "Re-evaluating
  Option B" above) rather than an oversight; `requestPasswordReset()` no
  longer pays the SMTP-latency component of this trade-off (a smaller,
  DB-only residual remains, see above).
- **Password reset gives up the Mailpit-visible-on-response determinism
  the other four methods keep.** The same reasoning that justifies keeping
  the other four synchronous (a trainee should see the email the moment
  the triggering response returns) applies at least as strongly to
  password reset — it is the one flow where reading the inbox is
  *mandatory*, not optional, to proceed. Not awaiting the send introduces
  a race between the HTTP response and the email's arrival in Mailpit,
  which is a real (if likely small) source of flakiness for anyone writing
  automated tests against this flow. Accepted here because the
  anti-enumeration requirement is a stated security property and the
  determinism property is not — but the cost is real and belongs here, not
  omitted.
- Does **not** bound DNS-resolution hangs or a host that keeps the
  connection alive without completing the transaction — named gaps, not
  silently accepted ones (see "What the chosen timeouts actually bound"
  above). This applies to all five methods, including
  `sendPasswordResetCode` — not awaiting the call removes the *timing*
  channel, not the underlying unbounded-hang risk to the mail subsystem
  itself, which Option A's timeout (still in effect via `deliver()`)
  addresses within its stated limits.
- If the sandbox's notification volume or reliability requirements grow
  later (e.g. if delivery guarantees become a stated product requirement —
  watch `PRD-043`, Welcome Email, which currently defers this exact
  question), this decision would need to be revisited toward something
  closer to Option C — this is an explicit non-goal today, not a permanent
  one.

## Risks

- **Technical:** An unvalidated timeout value could be too aggressive
  against Mailpit or a real SMTP provider under normal (non-failure) load,
  producing false failures; needs verification against actual Mailpit/SMTP
  behavior before shipping, not assumed correct from the ADR alone.
- **Technical:** DNS-hang and periodic-keepalive-without-progress remain
  unbounded under this decision (see Decision). If either proves to occur
  in practice, an outer wall-clock deadline is the named follow-up, not a
  reopening of this ADR's core choice of Option A.
- **Security, resolved in Revision 3:** the password-reset timing oracle
  flagged in Revision 2 is closed by narrowly applying Option B to
  `requestPasswordReset()`'s send (see Decision and "Re-evaluating Option
  B" above) — no longer an open risk for that path.
- **Security:** not-awaiting `sendPasswordResetCode()`'s call depends
  entirely on Option D making `deliver()` non-rejecting for that caller.
  If a future change reintroduces a code path inside `deliver()` that can
  throw *before* reaching its own catch (a bug in the catch's placement,
  not a mail-transport failure), the un-awaited call becomes a genuine
  unhandled rejection again. This dependency should be visible to whoever
  implements or later modifies `deliver()`, not assumed permanent.
- **Security, pre-existing and out of this decision's scope:** the
  no-SMTP-host fallback in `deliver()` logs the full message body —
  including the reset code, for `sendPasswordResetCode` — to application
  logs, by design, for local development. This ADR does not change or fix
  that; it's named here because it lives in the same file this ADR
  modifies and the question "is the logging path safe" applies to it too.
  See FINDING-0010.
- **Operational:** None beyond normal deploy risk.
- **Future migration:** If notification volume or reliability requirements
  later justify Option C, that migration touches every current call site
  (5+) that this ADR leaves synchronous or near-synchronous — a larger
  future change than if Option C were chosen now. Accepted here as a
  deliberate proportionality trade-off, not an oversight. `PRD-043` is the
  specific pending artifact that would trigger revisiting this, not a
  general "someday."

## Alternatives Rejected

- **Option B, applied to all five methods** — rejected: for
  `sendWelcomeEmail`/`sendOrderStatusEmail`/`sendDepositFiatEmail`/
  `sendDepositCryptoEmail`, there is no timing-sensitive requirement to
  close, and staying synchronous preserves the Mailpit-visible-on-response
  determinism named in "Re-evaluating Option B" above — applying B
  everywhere would give up that property for no corresponding benefit.
  **Revision 3 correction: Option B is not rejected in full.** Applied
  narrowly to `sendPasswordResetCode()`'s call site only, it is adopted —
  see Decision. The original rejection reasoning here (weakens
  failure-logging unless replicated per site; bounds nothing) was written
  before Option D was adopted and no longer applies to `deliver()`'s
  callers in general, since D makes `deliver()` itself non-rejecting; that
  is precisely why the narrow application became safe.
- **Option C** (queue/outbox) — rejected as disproportionate to this
  project's current stated requirements; revisit if notification
  reliability becomes an explicit product requirement.
- **Option D is not rejected** — adopted in combination with Option A (see
  Decision). Listed under Considered Options, not here, since it's part of
  the final decision, not an alternative to it.

## Related ADRs

- Related: `0008-duplicate-email-registration-race-handling.md` — same
  discovery pass (`docs/features/registration/DISCOVERY.md`), same
  underlying pattern of an unhandled failure mode on a request path with no
  existing app-wide handling convention.

## References

- `docs/features/registration/PRD.md` — Q-005, FC-003
- `docs/features/registration/DISCOVERY.md` — Candidate ADR 2, evidence
  trail this ADR is based on
- `docs/architecture/findings/ARCHITECTURE-REVIEW-FINDINGS.md` —
  FINDING-0004, FINDING-0005 (Revision 1), FINDING-0013, FINDING-0014
  (Revision 2 — timing oracle, missing `deliver()`-level alternative),
  FINDING-0016, FINDING-0017 (Revision 3 — misplaced logging rule,
  A+D+B re-evaluation narrowing the timing oracle), FINDING-0018
  (Revision 4 — claim-scoping and cross-reference fixes), FINDING-0010
  (named, not resolved — pre-existing plaintext secret logging in the
  no-SMTP-host fallback, out of this ADR's scope)
- Nodemailer transport options (timeouts):
  https://nodemailer.com/smtp/#connection-timeouts
