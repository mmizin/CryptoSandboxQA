# Documentation Follow-ups

Small, independently-actionable documentation edits identified as necessary
by an Accepted ADR or completed feature, but deliberately not bundled into
that feature's completion — implementation of an already-made decision, not
decision-making itself. Each item names its own owning document; completing
one does not reopen the feature or ADR that produced it.

## From ADR-0021 (Fallback path when an impersonation restore attempt is correctly refused)

**Owner: `docs/features/impersonation/PRD.md`**

1. Correct `FC-008`'s text — its Expected behavior asserts a retry
   mitigation ADR-0021's Context disproves (the restore token is removed
   from `localStorage` on any outcome, so no re-promotion-then-retry path
   is reachable).
2. Close `Q-001b`/`FC-008` as decided, citing ADR-0021, rather than
   leaving them recorded as open.
3. Add `G-001`'s stated qualifier — the goal holds only while the admin
   retains the admin role through the point they attempt to end
   impersonation.
4. Give the undifferentiated-refusal-messaging gap a tracker ID (no
   distinct message today for "your role changed" vs. any other restore
   rejection reason).

**Owner: `docs/features/admin-role-guards/PRD.md`**

5. Close `Q-007` part 2 / `FC-006` consequence (2) (the stranded
   `back_to_admin` token) as decided, citing ADR-0021 — per-consequence
   only. Consequence (1) (the target's session outliving the admin's
   demotion, `Q-007` part 1) remains undefined and should not be closed as
   a side effect.

**Owner: `architecture-librarian`**

6. Update `ADR-0016`'s Risks section, which currently states the
   stranded-token gap "remains unowned … no ADR currently claims it" —
   stale now that ADR-0021 claims it. Point its Related-ADRs framing at
   `ADR-0021`.
