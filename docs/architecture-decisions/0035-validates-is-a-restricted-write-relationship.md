# ADR-0035: `validates` is a restricted-write relationship

**Status:** Accepted (Phase 5 proposal §7.5, §21, decisions D5/D13; approved 2026-09-30)

## Context

Kerrick's brief asked for a formal mechanism recording that operating reality sufficiently conforms to architectural intent — not a feeling a reviewer has, but a specific, checkable act. Every other relationship type in the vocabulary (ADR-0018) is written by an ordinary `edit_architecture`-gated insert. A conformance judgment needs stronger guarantees than that: it must come from a review that actually looked at the initiative, that review must have concluded, and the judgment cannot be forged by an unrelated edit.

## Decision

- `validates` (Review → Implementation Initiative) is a relationship type, but it may be written **only** by `record_review_validation(review, initiative)` — never by the general-purpose relationship-insert path every other type uses.
- That operation requires `publish_architecture` (judgment-grade, the same weight as accepting a risk or publishing a baseline), refuses unless the review's status is `held`, refuses unless the review already `examines` the initiative or a core object the initiative `implements`, and refuses a duplicate validation from the same review.
- `record_review_validation` writes only the relationship. It does not itself change `implementation_status` — that is a separate call (ADR-0037), so the review's judgment and the initiative's formal closure remain two distinct, independently attributable acts.

## Consequences

- `validates` is the one relationship type in the vocabulary with its own authorization rule beyond capability + tenant checks. A future phase adding another judgment-grade relationship has a precedent to follow or deliberately diverge from — it is not automatically "just another relationship."
- The gate is meaningful specifically because it cannot be bypassed by an ordinary relationship edit; weakening this later (e.g. allowing a direct insert as a shortcut) would defeat the reason this ADR exists.
