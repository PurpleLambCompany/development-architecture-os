# Project Intelligence: schema, stewardship and client access (Phase 4)

Migrations:

- `20261002000000_project_intelligence_enums.sql` adds the enum values (opportunity, statuses, attention, triage, escalation, client action and contribution states, signal rules, file purposes).
- `20261002000100_project_intelligence.sql` holds everything else: tables, `private.build_element_snapshot` changes, operations and read models.

The specification is [`docs/product/PHASE_4_PROPOSAL.md`](../product/PHASE_4_PROPOSAL.md), the D1–D12 decisions are recorded there, and the decisions themselves are ADR-0026 to ADR-0033.

The database is the authority for every rule below. The application offers only the choices the database accepts, and the database checks them again.

## Vocabulary

Project Intelligence adds one record kind, `opportunity` (prefix `OPP`), to the six kinds Phase 3 already had (assumption, risk, constraint, dependency, decision, recommendation), and two typed relationships, `advances` and `pursues`, to the 31 already enforced. Nothing here is a new element kind separate from a record: opportunities are `architecture_elements` rows like any other record, with their own table (`opportunities`) holding the type-specific columns, exactly as Phase 3 records do.

## Rules that hold throughout

- **Stewardship is internal.** `intelligence_stewardship`, `intelligence_status_changes` and `intelligence_escalations` have no client policy at all. A client never reads attention, triage or escalation directly; they read only what a published snapshot or a client action carries (ADR-0027, ADR-0028).
- **Status changes are append-only history.** `intelligence_status_changes` rows are never updated or deleted; `private.record_intelligence_changes()` writes one row per changed field, and `private.guard_intelligence_log()` (a `BEFORE UPDATE OR DELETE` trigger) raises 23514 on any attempt to alter one.
- **Operations change state.** Triage, resolution, reopening, escalation, acknowledgement, sending and responding to client actions, contributions, contributor areas and signal dismissals change only through the functions below. Each locks the target row (`private.lock_intelligence_record` or `private.lock_client_action`), checks capabilities (42501) or business rules (23514), or reports a record the caller cannot see (P0002).
- **Resolution is per kind.** `intelligence_terminal_statuses(kind)` and `intelligence_active_statuses(kind)` are the single source of truth for which statuses are terminal; `resolve_intelligence_record` refuses a status outside the kind's terminal set, and refuses to resolve an already-terminal record (`'The record is already %; reopen it first'`, 23514).
- **Accepting a risk is a publishing judgment.** `resolve_intelligence_record` requires `publish_architecture`, not just `edit_architecture`, when the new status is `accepted`.
- **Client visibility never widens on resolution.** Resolving with `p_publish = true` runs the same `build_element_snapshot`/publish path as Phase 3; nothing here bypasses it.
- **Categories are a controlled vocabulary, per kind.** `intelligence_record_domains` (assumption, risk, decision, recommendation) mirrors `INTELLIGENCE_CATEGORIES` in `src/domain/intelligence/catalog.ts`; a pgTAP assertion checks the mirror stays exact. Constraint keeps its Phase 3 `CONSTRAINT_CATEGORY_LABELS`.
- **Signals are computed, never stored as conclusions.** `intelligence_signals()` evaluates the ten rules in ADR-0032 (severity ≥ 15, opportunity window closing within 30 days, untriaged for more than 7 days, and the rest) against the live register each call; only a _dismissal_ is stored, keyed by rule, subject (element or client action) and a fingerprint of the triggering facts, so a signal reappears automatically once its facts change even if it was dismissed before.
- **Client requests name one person about one engagement.** `assert_client_action_addressee` refuses an addressee who lacks `view_architecture` and the capability the kind needs (`approve_architecture` for `executive_attention`, `respond_to_client_actions` otherwise, 23514), and refuses subjects outside an area-limited addressee's areas.
- **Client words become evidence only when TPLCo says so.** A response or a contribution is never itself evidence; `record_response_as_evidence` and `handle_client_contribution` (with `p_record_as_evidence`) create an `architecture_evidence_sources` row with `provenance = 'client_source'`, requiring `edit_architecture`.
- **Contributor areas gate what a client without the full architecture sees**, not what they may do (ADR-0030). A domain area or an element-and-everything-under-it area; with none, they see nothing beyond what a client action names.
- **Files are registered, then uploaded.** `register_engagement_file` picks the storage path and checks who may attach what to what (a response, a contribution, or an evidence source); the browser then uploads directly to that signed path, so no file body passes through a server action (Vercel's request body limit is why).
- **Timestamps use `clock_timestamp()`**, so histories, escalations and client-action events written in one transaction still order correctly.
- **Finance never controls architecture, and the reverse.** No Phase 4 table references a finance table (ADR-0023 still holds).

## New tables

| Table                            | Holds                                                                                    | Client policy                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `opportunities`                  | Value, feasibility, attractiveness (generated), window, status                           | published snapshot only                                                                                             |
| `intelligence_stewardship`       | Attention, next review date, triage state and note                                       | none                                                                                                                |
| `intelligence_status_changes`    | Append-only field-level history: operation, field, from/to, rationale, actor             | none                                                                                                                |
| `intelligence_escalations`       | Level (Principal Architect / client executive), reason, acknowledged/resolved            | none directly; a client sees only the `executive_attention` action it raises                                        |
| `intelligence_signal_dismissals` | Rule, subject, fingerprint, reason, expiry                                               | none                                                                                                                |
| `client_actions`                 | One request, its kind, addressee, subjects, status                                       | addressee, and `assign_client_actions` holders, see the whole engagement's                                          |
| `client_action_subjects`         | Published, client-visible elements a request is about                                    | as above                                                                                                            |
| `client_action_responses`        | The addressee's written response, link, files                                            | as above                                                                                                            |
| `client_action_events`           | Sent/responded/returned/closed/withdrawn/reassigned history                              | as above                                                                                                            |
| `client_contributions`           | Client input on one published, client-visible element                                    | the submitter, and internal readers                                                                                 |
| `engagement_member_areas`        | A client member's domain or element-subtree scope                                        | their own                                                                                                           |
| `engagement_files`               | Uploaded file metadata; the storage object itself lives in the `engagement-files` bucket | files attached to something they can see, including any published version of a deliverable they can read (ADR-0075) |

## Capabilities (ADR-0031)

| Capability                  | Side     | Default holders                                                        |
| --------------------------- | -------- | ---------------------------------------------------------------------- |
| `manage_client_requests`    | internal | Principal Architect, Researcher                                        |
| `submit_client_input`       | client   | Client Contributor                                                     |
| `respond_to_client_actions` | client   | Client Contributor, Client Project Lead, Executive Sponsor             |
| `assign_client_actions`     | client   | Client Project Lead, Executive Sponsor                                 |
| `view_full_architecture`    | client   | Client Viewer (not Client Contributor, who is area-limited by default) |

`edit_architecture` and `publish_architecture` (Phase 3) also gate triage/resolution/escalation and publishing a resolution, respectively; nothing new is granted to System Administrators by default.

## Signals (ADR-0032)

| Rule                                         | Fires when                                                      |
| -------------------------------------------- | --------------------------------------------------------------- |
| `assumption_unvalidated_underpins_published` | an active, unvalidated assumption underpins a published element |
| `assumption_invalidated_still_underpins`     | an invalidated assumption still underpins a live element        |
| `risk_high_without_mitigation`               | an active risk with severity ≥ 15 has nothing `mitigates`ing it |
| `dependency_blocking_unsatisfied`            | a blocking dependency is not `satisfied`                        |
| `decision_past_needed_by`                    | an open or recommended decision is past `needed_by`             |
| `opportunity_window_closing`                 | an open opportunity's window closes within 30 days              |
| `opportunity_window_closed`                  | an open opportunity's window has already closed                 |
| `review_overdue`                             | an active record's `next_review_on` has passed                  |
| `record_untriaged`                           | a record has been untriaged for more than 7 days                |
| `client_action_overdue`                      | an open client action is past `due_on`                          |

Every rule is deterministic SQL over the current register; nothing here is AI-generated, and a dismissal is a stored judgment with a reason, never a suppression of the underlying fact.

## Read models

| Function                                                       | Returns                                                                                                      | Access                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `intelligence_register(engagement?)`                           | every record the caller may read, with stewardship, escalation and open-request counts joined in             | internal: one or all engagements; client: none (client reads snapshots)        |
| `intelligence_history(element)`                                | append-only field history                                                                                    | internal only                                                                  |
| `intelligence_impact(element, depth)`                          | a structural trace outward (part_of/serves/shapes/informs/…, `requires` inbound, dependency ends), 1–5 steps | internal (`security invoker`, so RLS on `architecture_elements` still applies) |
| `intelligence_signals(engagement, as_of?, include_dismissed?)` | the ten rules evaluated against the live register                                                            | internal only                                                                  |

## Spec §30 acceptance checks and where they are proven

| Check                                                                        | pgTAP |          Browser (manual/e2e)           |
| ---------------------------------------------------------------------------- | :---: | :-------------------------------------: |
| A record can be triaged, resolved, reopened and escalated                    |   ✓   |                    ✓                    |
| A client executive escalation reaches a named executive only                 |   ✓   |                    ✓                    |
| An area-limited contributor sees only their areas                            |   ✓   |                    ✓                    |
| A client action reaches only an eligible addressee                           |   ✓   |                    ✓                    |
| A response is not evidence until TPLCo records it as such                    |   ✓   |                    ✓                    |
| A dismissed signal returns once its facts change                             |   ✓   | n/a (unit-tested in `register.test.ts`) |
| Concurrent triage/escalation/dismissal stay consistent                       |   ✓   |                   n/a                   |
| Client users never reach `intelligence_stewardship` or the escalations table |   ✓   |                   n/a                   |

## Tests

`supabase/tests/12_intelligence_registers.test.sql` (registers, triage, resolution, reopening, escalation), `13_client_actions.test.sql` (the whole client-action and contribution lifecycle, including storage policies on `engagement-files`), `14_contributor_areas.test.sql`, `15_escalations_and_signals.test.sql`, and `99_intelligence_concurrency.test.sql` (concurrent operations via `dblink`). `src/domain/intelligence/register.test.ts` and `src/domain/intelligence/catalog.test.ts` cover the pure filtering/ordering logic and the category mirror in TypeScript.
