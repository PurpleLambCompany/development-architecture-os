# ADR-0069: Keeping an interpretation without a new secret

**Status:** Accepted (Phase 7B.2 Step A; decisions approved by Kerrick 2026-10-01)

## Context

Phase 7B.2 proposal §14 and §15; reconciliation decision IX-12; Kerrick's PD-3, PD-4, PD-5 and PD-21.

In 7B.2 the application generates every interpretation ephemerally. An interpretation enters the governed interpretation and judgment lifecycle only when a person signals that it should: by keeping it, or by judging it (PD-3, PD-21). What is kept must be exactly what the person was shown: never regenerated (a second call would produce different text), and never text a browser sent back. The proposal's Revision 1 offered an HMAC keep token signed with a new server secret. Kerrick's PD-4 required the same guarantees **without a new long-lived secret**: exact-output integrity, requester binding, subject and kind binding, basis binding, an expiry of about thirty minutes, and replay resistance.

## Decision

**Nothing persists on generation.** The application calls the Gateway only in `ephemeral` mode, and only on a person's explicit action (IX-16). A source scan (`imports.test.ts`) proves no application module requests `persist`; `persist` remains only for the evaluation harness on synthetic engagements. Viewing, generating, closing the drawer, or judging the deterministic Edge item while an interpretation is open persists nothing beyond the metadata-only audit row.

**The server holds the exact output.** When the Gateway validates an interpretation on the application path, it calls `record_architecture_intelligence_request` with outcome `returned` and the validated output. The operation verifies it exactly as it verifies a persisted inference (the shared authorisation lock, the full context gate, the same authorisation version, every basis row re-emitted through the Tool Contract with the same class and digest, and no claim citing a handle outside the basis, through `private.verify_inference_basis`), writes the audit row, and holds the output in `public.pending_architecture_inferences`:

| Column                          | Meaning                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `request_id` (primary key)      | The `returned` request that produced it; same-engagement foreign key to the request audit |
| `engagement_id`, `requested_by` | The engagement and the requester (set from the session by the guard)                      |
| `inference`                     | The validated output, its subject columns and its verified basis, in the recording shape  |
| `created_at`, `expires_at`      | Set by the guard; `expires_at` is `created_at` plus thirty minutes, enforced by a check   |

The table is working state, not history. RLS is enabled, every privilege is revoked from `public`, `anon` and `authenticated`, and no policy exists: **no role can read it**. The guard (`private.guard_pending_architecture_inference`) refuses every update (`23514`) and any insert or delete outside the operations' marker (`42501`). The browser receives the output for display, the request id and the keep deadline, never anything it can use to alter what is kept. Only `returned` outcomes on `ephemeral` requests may hold an output; `nothing_to_add` and every refusal hold nothing.

**Keeping names only the request.** `public.keep_architecture_inference(engagement, request_id, judgment?)` takes no content. The database supplies it from the pending row. It is refused unless, now:

- the caller reads the engagement and holds `use_architecture_intelligence`;
- a pending row exists for that request on that engagement, belongs to the caller and has not expired, and the request is `returned`, `ephemeral` and the caller's. Someone else's request reads exactly like an expired one: "This interpretation can no longer be kept. Interpret again.";
- the engagement passes the full context gate under the same authorisation version as the request;
- every basis row still re-emits with the same class and digest and every claim cites only basis handles; otherwise "This interpretation's basis has changed. Interpret again."

It then inserts the inference and its basis through `private.insert_architecture_inference`, with `request_id` naming the earlier `returned` request, generation time unchanged (`requested_at`) and the new `architecture_inferences.kept_at` set to the time of the keep, and deletes the pending row in the same transaction.

**How each PD-4 guarantee is met.**

| Guarantee                | Mechanism                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact-output integrity   | The only stored copy is the one the Gateway validated and the database verified in the same call; keep accepts no content. Exact shown text is persisted text |
| Requester binding        | `requested_by` comes from the session; keep requires it to be the caller, on both the pending row and the request (PD-5)                                      |
| Subject and kind binding | The request row fixes kind and subject; the pending row is keyed by that request and the inference is inserted from it                                        |
| Basis binding            | Basis digests are verified at generation and again at keep, under the authorisation lock                                                                      |
| Expiry                   | Thirty minutes (`KEEP_WINDOW_MS` in the Gateway, the check constraint and the guard in the database), enforced on every keep                                  |
| Replay resistance        | One pending row per request, removed when kept; a request can produce at most one inference                                                                   |

**Purging.** `private.purge_expired_pending_inferences()` removes expired rows across the deployment and is called by every recording and keep operation. The trigger `engagement_ai_authorizations_purge_pending` removes every pending row of an engagement when any new authorisation version is recorded (a revocation, a change of classes, provider or region, or a renewal): keeping requires the same authorisation version anyway, and the shared and exclusive locks on the authorisation key serialise keeping with that change. Nothing about a pending interpretation survives a reauthorisation.

**Keeping by judging is one transaction (PD-3, PD-21).** An ephemeral interpretation is judged only by persisting it. Passing a judgment (`kind`, `reason`, `expires_on`, `promotion_target_kind`, `promotion_target_id`; any other key is refused) to `keep_architecture_inference` additionally requires `edit_architecture` (PD-6), keeps the interpretation and records the judgment on the new inference in the same transaction, under the judgment lock: both are recorded or neither is, and the judgment applies to exactly the interpretation the person saw. The judgment form says "Judging keeps this interpretation."

**Only the requester may keep (PD-5).** Any holder may then read and, with `edit_architecture`, judge the kept inference (ADR-0070). Keep is labelled **Keep for this Review** on a Review.

**Not in `activity_log`** (OD-10). The kept inference and its basis are their own attributed, append-only records (ADR-0064).

## Consequences

- No new secret exists to provision, rotate or leak. Trust in kept content rests on the database, which already verifies every inference.
- A pending interpretation is durable for at most thirty minutes before a person signals intent, but it is unreadable by every role and removed on expiry, on keep and on any authorisation change. Nothing durable that a person can read exists before Keep except the metadata-only audit row.
- Keep cannot alter or forge text: it sends only a request id, and a leaked request id is useless to anyone but its requester within its window.
- **Trust boundary, inherited from 7B.1 (found in the independent diff inspection).** The Gateway runs as the requesting user, so `record_architecture_intelligence_request` is executable by `authenticated`, as it was in 7B.1 for `persist`. A holder of `use_architecture_intelligence` who calls it directly from their own signed-in session, rather than through the application, can hold an interpretation whose text the Gateway never validated. The basis must still verify, and keeping still binds the requester and their attribution. That text could then be kept and shown to other holders as a suggested interpretation. Closing this needs the recording operation to accept outputs only from the server, for example a server-only role or a server-held key. That is a deliberate change to the 7B.1 trust model, which ADR-0062 states. It is not made in Step A, and it is raised for Kerrick's decision before Step B.
- Differences from proposal Revision 1, recorded for review: the HMAC keep token and `ARCHITECTURE_INTELLIGENCE_KEEP_SECRET` were not built (PD-4 as approved); keep-and-judge is one database operation in one transaction rather than two operations in order; the migrations are ordered keeping (`20261008000100`), judgments (`20261008000200`), keep operation (`20261008000300`).
