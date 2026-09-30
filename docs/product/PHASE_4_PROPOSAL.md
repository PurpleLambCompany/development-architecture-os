# Phase 4 — Project Intelligence: Proposal

**Status:** Approved for implementation 2026-09-30 ("approved", Kerrick Jordan), with the recommended answer to each decision in §16. Being built on this branch.
**Branch:** `phase-4-project-intelligence` · **Date:** 2026-09-30
**Builds on:** Phase 1 (engagements, roles, capabilities, RLS), Phase 2 (commercial engagement) and Phase 3 (Architecture Core), all merged.
**Governing documents:** `DSA_OS_MASTER_BUILD_SPEC.md` §3, §4, §6, §7, §8, §17, §18, §26, §27, §31; `docs/product/PHASE_3_PROPOSAL.md` and `PHASE_3_REPORT.md`; ADR-0008, ADR-0009 and ADR-0013 to ADR-0025.

Phase 3 built the Project Intelligence **records**: assumptions, risks, constraints, dependencies, decisions and recommendations. They share the Architecture Core element spine, relationships, statements, evidence, publication and versions. Phase 4 builds the Project Intelligence **experience** on top of those records, without redesigning or duplicating them:

- deeper registers, with triage, filtering and prioritization;
- a seventh record kind, **Opportunity**;
- escalation and resolution flows, with a structured history of how each record changed over time;
- **client actions**: what TPLCo needs from the client, answered in the portal;
- **per-area participation** for Client Contributors;
- the client Knowledge maps and Capability matrices deferred from Phase 3;
- deterministic **intelligence signals** that prepare the ground for Architecture Intelligence without any AI.

Nothing in Phase 4 changes how architecture is published, versioned, approved or evidenced. A Project Intelligence record is still an element: it still reaches clients only as a published, immutable snapshot, and it is still connected to the Architecture Core only through the Phase 3 relationship vocabulary.

---

## 1. Principles

Every Phase 3 principle holds. Phase 4 adds these:

1. **Intelligence qualifies the architecture; it is not a second architecture.** Opportunities, triage, escalations and signals all attach to Phase 3 elements. No Phase 4 table holds architecture content of its own.
2. **Not a task system.** Client actions are **requests from TPLCo to the client** (a question, an information request, a confirmation, a review of a published item, an executive escalation). They are not a general task list: there are no internal tasks, subtasks, boards, percentages or kanban columns. Triage is a judgment about attention, not a work queue.
3. **Status is not publication.** A record's status (for example a risk moving from open to mitigating) changes on the working copy and is recorded in its history. The client sees it only when TPLCo publishes a new version, exactly as in Phase 3. Phase 4 makes publishing a status change quick; it never bypasses publication.
4. **Accountability, not assignment.** Every record has one accountable internal owner (the Phase 3 `owner_user_id`). Client accountability is expressed as a client action addressed to a named client member, never as a client "owner" field on an architecture element.
5. **Least privilege for clients.** A Client Contributor sees and acts only within the areas TPLCo assigns them (spec §4, §27). Client Viewers stay read-only. Client Finance keeps its Phase 3 view.
6. **Signals are system-derived and labeled.** Deterministic rules may point out gaps (an unvalidated assumption underpinning a published decision, for example). Their output carries `system_derived` provenance, is internal, and never changes a record by itself. AI is not built; its future output will enter through the same review gate as Phase 3's `ai_analysis`.
7. **Portfolio learning waits for its phase.** Phase 4 makes intelligence comparable across engagements (controlled categories) but builds no cross-client analytics (spec §17, Phase 8).

---

## 2. Scope

### 2.1 Proposed for Phase 4

- **Registers** for all seven record kinds, with triage (attention level, next review date, triaged by and when), filtering, sorting and prioritization rules per kind (§5).
- **Opportunity**, a new Project Intelligence record kind (`OPP`) with its own fields, statuses and two new relationship types (§4).
- **Deeper fields** where the spec asks for them and Phase 3 left them out: assumption evidence summary is already covered by statements; this proposal adds controlled categories for every kind, a `materialized` risk status, and dependency and constraint review dates (§6.3).
- **Escalation** of a record to the Principal Architect or to the client executive, with acknowledgement and resolution (§7.1).
- **Resolution** operations per kind, with a required rationale, and a quick path to publish the resolved status (§7.2).
- **Intelligence history:** an append-only record of every status and scoring change, with who, when and why, and a trend view (§7.3).
- **Client actions** (§8): requests sent to named client members, answered in the portal, accepted or returned by TPLCo, optionally recorded as client-source evidence. The client **Actions** tab goes live.
- **Client contributions** (§8.5): a client member may submit input on a published element in their areas; TPLCo triages it into statements or evidence.
- **Per-area participation for Client Contributors** (§9): TPLCo assigns areas (a domain, or an element and everything under it). Contributors see and act only within them.
- **Client domain views** (§10.2): the Knowledge map and Capability map and matrices deferred from Phase 3, drawn from published snapshots only.
- **Intelligence ↔ Architecture Core views** (§10.1): what bears on each element; impact traces from a record to everything it touches; overlays in the domain workspaces.
- **Intelligence signals** (§11): deterministic, system-derived checks, dismissible with a reason.
- **New capabilities and RLS** (§12).
- **Controlled categories** so intelligence can later be compared across engagements (§6.2).

### 2.2 Not in Phase 4

- **AI, Architecture Intelligence and the Structural Coherence Engine** (spec §18, §19; Phase 7).
- **Deliverables, implementation tracking and Executive Review mode** (spec §11–§13; Phase 5). Phase 4's escalation to the client executive is a request for attention, not a review session.
- **Method Library, templates, patterns, Method versioning** (Phase 6), **portfolio analytics** (Phase 8), **certification and licensing** (Phase 9).
- **Messages** (spec §7 navigation). Client actions and contributions are structured and bound to records; they are not a chat.
- **Email notifications.** Still waiting on the email-provider decision from Phase 2. The portal overview and Actions tab show what is outstanding.
- **Graph visualization** (spec §23). Maps, matrices, trees and traces as in Phase 3.

### 2.3 Conflicts with the specification (surfaced as `CLAUDE.md` requires)

| Spec                                                                                                           | This proposal                                                                                                                                                                            | Status                |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| §26 `client_actions.assigned_to_user_id` and a free `action_type`                                              | Actions are addressed to an **engagement member** (so suspension and area rules apply) and have a closed set of kinds. Approvals and decisions stay Phase 3 records and appear alongside | Proposed              |
| §8 "Client Actions: items awaiting upload"                                                                     | Information requests accept an HTTPS link and a note. File upload waits for the shared upload work, unless you include it here (§16, D12)                                                | Decision requested    |
| §6 "Opportunity Register: for strategic possibilities"                                                         | Opportunity is a Project Intelligence record kind with a value × feasibility grid and a time window, distinct from Structural Leverage and Intended Outcome (§4)                         | Vocabulary for review |
| §6 "owner" on assumptions, risks, dependencies; §26 `owner_user_id` on each table                              | One accountable **internal** owner on the element spine (Phase 3 column). Client accountability is a client action (§1.4)                                                                | Proposed              |
| §4 Client Contributor "only assigned project areas"; Phase 3 gave Contributors the full published architecture | Contributors are narrowed to assigned areas by a new `view_full_architecture` capability that they lack by default (§9). This changes Phase 3 behavior for Contributors                  | Decision requested    |
| §17 portfolio metrics "recurring risks", "recurring capability gaps"                                           | Phase 4 adds controlled categories so these can be computed later; the metrics themselves are Phase 8                                                                                    | Proposed              |

---

## 3. What Phase 4 adds to the model

```
Architecture element (Phase 3 spine: lifecycle, visibility, provenance, owner, versions)
 ├─ core object          (unchanged)
 └─ Project Intelligence record
      ├─ subtype row      (assumption, risk, constraint, dependency, decision, recommendation, opportunity*)
      ├─ stewardship*     (attention level, category, next review, triaged by and when)
      ├─ status history*  (every status and score change, with rationale)
      ├─ escalations*     (to the Principal Architect or the client executive)
      └─ relationships    (Phase 3 vocabulary + advances*, pursues*)

Client action*        → addressed to one client engagement member, about published elements
 └─ responses*        → optionally recorded as client-source evidence (Phase 3 evidence system)
Client contribution*  → a client member's input on a published element, triaged by TPLCo
Contributor area*     → a domain, or an element and its part_of descendants
Intelligence signal*  → computed by deterministic rules; dismissals stored
                                                              * new in Phase 4
```

---

## 4. Opportunity: vocabulary for review

### 4.1 The record kind

| Kind          | Prefix | Label       | Definition                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------- | ------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `opportunity` | `OPP`  | Opportunity | A possibility identified during architecture work that, if pursued, would materially advance the development, and that may be lost if not acted on. Not a Structural Leverage (a durable structural advantage the strategic model already uses). Not an Intended Outcome (the result the development seeks). Not a Recommendation (TPLCo's advised course of action, which may pursue an opportunity) |

**Fields** (`opportunities`, keyed by `element_id`):

- `category`, from the controlled list (§6.2);
- `value` (1 to 5): how much it would advance the development if realized;
- `feasibility` (1 to 5): how achievable it is with the capability and resources in view;
- `attractiveness`, a generated column = value × feasibility, never typed in (the mirror of risk severity);
- `window_opens_on`, `window_closes_on` (dates, optional): when the opportunity can be acted on;
- `pursuit_approach` (text);
- `opportunity_status`: `identified`, `evaluating`, `pursuing`, `realized`, `declined`, `lapsed`.

**Scope:** as every Phase 3 record: domains, specific elements, or engagement-wide (Phase 3 §3.2).

### 4.2 Two new relationship types

| Key        | Reads (inverse)           | Allowed source → target                                                       | Definition                                                                                   |
| ---------- | ------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `advances` | advances (is advanced by) | Opportunity → element (other than Risk and Opportunity)                       | If the opportunity is realized, the target is materially advanced. The mirror of `threatens` |
| `pursues`  | pursues (is pursued by)   | Capability object, Application object, Decision, Recommendation → Opportunity | The source acts to realize the opportunity. The mirror of `mitigates`                        |

The existing Project Intelligence relationships extend to opportunities where they already make sense, and nowhere else:

- `underpins`: Assumption → Opportunity (the opportunity holds only if the assumption is true);
- `constrains`: Constraint → Opportunity;
- `threatens`: Risk → Opportunity (already allowed, because the target is "element other than Risk");
- `affects` and `addresses`: already allowed for any record source and any element target.

With these, the vocabulary grows from 31 to 33 relationship types. The rules are added by migration exactly as in Phase 3, and the TypeScript vocabulary is regenerated and checked against the migration.

---

## 5. Registers: triage, filtering and prioritization

### 5.1 Triage (stewardship)

Every Project Intelligence record gains one stewardship row (`intelligence_stewardship`, keyed by `element_id`). It is internal working metadata: it is **not** versioned, never enters a snapshot and never reaches a client.

| Field                      | Meaning                                                                                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attention`                | TPLCo's judgment of the attention the record needs now: `critical`, `high`, `routine`, `watch`. Distinct from a Recommendation's client-facing `priority` and from computed risk severity |
| `triage_state`             | `untriaged` (new, or reopened) or `triaged`                                                                                                                                               |
| `triaged_by`, `triaged_at` | Set by the triage operation                                                                                                                                                               |
| `next_review_on`           | A date by which the owner should look at the record again. Overdue reviews surface as a signal (§11)                                                                                      |
| `category`                 | From the controlled list for its kind (§6.2)                                                                                                                                              |

Triage is done by holders of `edit_architecture`. Setting `attention` to `critical` records the reason in the status history (§7.3).

### 5.2 Filtering

Every register, per engagement and across engagements (internal), filters by:

- kind; domain; a specific element (records that bear on it through any Project Intelligence relationship); engagement-wide;
- status (per kind); lifecycle; client visibility; provenance;
- attention; triage state; owner; category;
- review due (overdue, within 14 days); escalated; has open client actions; has open signals.

Filters live in the URL, so a filtered register can be shared with a colleague. There are no saved personal views in Phase 4.

### 5.3 Prioritization (default order per register)

The default sort puts what needs judgment first. Each is deterministic and explained in the register's header.

| Register        | Default order                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Risks           | Escalated first; then attention; then severity (probability × impact); then next review date               |
| Assumptions     | Escalated; attention; then those underpinning published elements with low confidence and not yet validated |
| Constraints     | In force and non-negotiable first; then attention                                                          |
| Dependencies    | Blocking and broken or at risk first; then attention; then next review date                                |
| Decisions       | Open or recommended with the earliest `needed_by` first; overdue first of all                              |
| Recommendations | Priority (critical, important, advisable); then awaiting client response                                   |
| Opportunities   | Window closing soonest; then attractiveness (value × feasibility)                                          |

Each register keeps its own visual form: the risk grid (probability × impact), an opportunity grid (value × feasibility), dependencies as a from → to list with blocking marked, and decisions with their options. No kanban.

---

## 6. Schema changes

The mechanics follow Phases 1–3: `uuid` ids; `engagement_id` on every table with composite same-engagement foreign keys; `created_by`, `created_at`, `updated_at`; column-limited grants; operations as `SECURITY DEFINER` functions that lock, check capabilities (42501), validate (23514) and log.

### 6.1 Enum values (their own migration, as in Phases 2 and 3)

- `element_kind`: add `opportunity`.
- `risk_status`: add `materialized` (the risk has occurred; decision D4).
- `engagement_capability`: add the capabilities in §12.1.

Enum values are permanent (§15).

### 6.2 Controlled categories

`intelligence_categories` (reference data, migration-managed, readable by signed-in users, writable by no one): `record_kind`, `key`, `label`, `definition`, `sort_order`. Each record's category (currently free text on assumptions and risks) references it; existing values are mapped in the migration, and `other` exists for every kind.

Proposed lists (for review, D3):

| Kind           | Categories                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| Assumption     | market, stakeholder, financial, capability, regulatory, operational, timing, other                             |
| Risk           | strategic, financial, capability, governance, stakeholder, regulatory, delivery, reputational, external, other |
| Constraint     | Phase 3 enum kept (regulatory, financial, physical, contractual, political, temporal, other)                   |
| Dependency     | Phase 3 `dependency_type` kept as its category                                                                 |
| Decision       | structural, governance, investment, partnership, sequencing, other                                             |
| Recommendation | structural, capability, governance, strategic, operational, other                                              |
| Opportunity    | partnership, funding, market, land and asset, talent, policy, other                                            |

### 6.3 Changes to Phase 3 tables (additive only)

- `opportunities` (new subtype, §4.1).
- `assumptions.category`, `risks.category`: move from free text to a key in `intelligence_categories` (data migrated; free text removed).
- `decisions`, `recommendations`: gain `category`.
- The element spine, statements, relationships, versions, approvals and baselines are **unchanged**. The snapshot builder learns the `opportunity` subtype.

### 6.4 New tables

| Table                            | Purpose                                                                                                                                                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `intelligence_stewardship`       | §5.1. One row per record, created with the record                                                                                                                                                                                               |
| `intelligence_status_changes`    | Append-only history (§7.3): `element_id`, `field`, `from_value`, `to_value`, `rationale`, `changed_by`, `changed_at`, `operation`. Written by triggers on the subtype and stewardship tables and by operations                                  |
| `intelligence_escalations`       | §7.1: `element_id`, `level` (`principal_architect`, `client_executive`), `reason`, `raised_by`, `raised_at`, `acknowledged_by`, `acknowledged_at`, `resolved_by`, `resolved_at`, `resolution_note`, `client_action_id` (for client escalations) |
| `client_actions`                 | §8: `reference_code` (`ACT-001`), `kind`, `title`, `request`, `addressed_to_member_id`, `due_on`, `status`, `sent_by`, `sent_at`, `closed_by`, `closed_at`, `close_note`                                                                        |
| `client_action_subjects`         | The published elements an action is about (`action_id`, `element_id`; same engagement)                                                                                                                                                          |
| `client_action_responses`        | Append-only: `action_id`, `responded_by`, `body`, `link_url` (HTTPS only), `responded_at`; `recorded_as_evidence_source_id` once TPLCo records it as evidence                                                                                   |
| `client_contributions`           | §8.5: `element_id` (published, in the contributor's areas), `submitted_by`, `body`, `link_url`, `status` (`received`, `incorporated`, `acknowledged`), `handled_by`, `handled_at`, `handling_note`                                              |
| `engagement_member_areas`        | §9: `engagement_member_id` (a client member), exactly one of `domain` or `element_id`, `assigned_by`, `assigned_at`                                                                                                                             |
| `intelligence_signal_dismissals` | §11: `rule_key`, `element_id`, `reason`, `dismissed_by`, `dismissed_at`, `expires_on` (optional)                                                                                                                                                |

Reference counters gain the `OPP` and `ACT` prefixes (ADR-0025 rules: sequential per engagement, never reused).

No Phase 4 table references a finance table (ADR-0023 holds).

### 6.5 Operations (new)

| Operation                                                               | Capability                                                                                                     | What it does                                                                                                                                                                          |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `triage_intelligence_record`                                            | `edit_architecture`                                                                                            | Sets attention, category and next review; marks triaged                                                                                                                               |
| `resolve_intelligence_record`                                           | `edit_architecture` (risk acceptance: `publish_architecture`)                                                  | Moves a record to a terminal status for its kind with a required rationale; optionally publishes the new version in the same transaction when the caller holds `publish_architecture` |
| `reopen_intelligence_record`                                            | `edit_architecture`                                                                                            | Returns a resolved record to an active status with a rationale; triage state becomes untriaged                                                                                        |
| `escalate_intelligence_record`                                          | `edit_architecture` (principal level); `publish_architecture` (client executive level)                         | Raises an escalation; a client-executive escalation requires the record to be published and client-visible, and sends a client action                                                 |
| `acknowledge_escalation`, `resolve_escalation`                          | Principal Architect level: `publish_architecture`; client level: resolved by TPLCo after the client responds   | Close the loop with a note                                                                                                                                                            |
| `send_client_action`                                                    | `manage_client_requests`                                                                                       | Validates the addressee (active client member with `respond_to_client_actions`, within their areas) and that every subject is published and client-visible; assigns `ACT-nnn`         |
| `respond_to_client_action`                                              | Client: `respond_to_client_actions` and addressed to the caller (or `assign_client_actions` on the engagement) | Appends a response; status becomes `responded`                                                                                                                                        |
| `reassign_client_action`                                                | Client: `assign_client_actions`; TPLCo: `manage_client_requests`                                               | Re-addresses to another eligible client member, with a note                                                                                                                           |
| `close_client_action`, `return_client_action`, `withdraw_client_action` | `manage_client_requests`                                                                                       | Accept the response and close; return it for more (back to open, with a note); or withdraw an open request                                                                            |
| `record_response_as_evidence`                                           | `edit_architecture`                                                                                            | Creates an evidence source with `client_source` provenance from a response (internal visibility by default) and optionally cites it on a statement                                    |
| `submit_client_contribution`                                            | Client: `submit_client_input`, element in the caller's areas                                                   | Appends a contribution                                                                                                                                                                |
| `handle_client_contribution`                                            | `edit_architecture`                                                                                            | Marks it incorporated (optionally recording it as evidence, as above) or acknowledged, with a note                                                                                    |
| `assign_contributor_area`, `remove_contributor_area`                    | Principal Architects and those who manage the engagement team (D8)                                             | Grant or remove an area for a client member                                                                                                                                           |
| `dismiss_intelligence_signal`                                           | `edit_architecture`                                                                                            | Records a reason; the signal stays hidden until its condition changes or the dismissal expires                                                                                        |

### 6.6 Read models (security invoker unless stated)

- `intelligence_register(engagement, filters)`: records with stewardship, latest status change, escalation state, open client actions and open signals, in the default order for the kind.
- `intelligence_history(element)`: the status history as a time series.
- `intelligence_impact(element, depth)`: the trace from a record through Project Intelligence and design-flow relationships to every element it touches (reuses the Phase 3 graph rules).
- `intelligence_signals(engagement)`: computed signals (§11), minus live dismissals. `SECURITY DEFINER`, internal readers only.
- `client_action_queue(engagement)`: for a client member, their open requests, plus approvals and decisions awaiting them (Phase 3), in one list.
- `client_domain_views(engagement, domain)`: the published, client-visible objects and relationships a client may see, shaped for the client maps and matrices.
- `architecture_activity` (Phase 3) gains the Phase 4 events: triaged, escalated, resolved, reopened, client action sent, responded, closed, contribution received and handled, area assigned.

---

## 7. Escalation, resolution and history

### 7.1 Escalation

Two levels, both explicit and recorded:

1. **Principal Architect:** an Architect or Researcher raises a record for a Principal Architect's attention, with a reason. It appears at the top of the register and on the Principal's Reviews page until acknowledged and resolved.
2. **Client executive:** a holder of `publish_architecture` escalates a **published, client-visible** record to the client's executive. This sends a client action of kind `executive_attention` to a client member holding `approve_architecture` (by default the Executive Sponsor), naming the record. The escalation is resolved when TPLCo closes that action.

Escalation never changes a record's status, lifecycle, visibility or maturity.

### 7.2 Resolution

Each kind has defined terminal statuses. Resolving needs a rationale; evidence can be cited through the record's statements as usual.

| Kind           | Resolved as                                  | Note                                                                                                                                                               |
| -------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Assumption     | `validated`, `invalidated`                   | Invalidating raises an impact signal on everything it underpins (§11)                                                                                              |
| Risk           | `closed`, `accepted`, `materialized` (D4)    | Acceptance is a judgment: `publish_architecture`. A materialized risk stays in the register; its consequences are recorded as decisions, dependencies or new risks |
| Constraint     | `relaxed`, `lifted`                          |                                                                                                                                                                    |
| Dependency     | `satisfied`, `broken`                        | A broken blocking dependency raises a signal on its dependent element                                                                                              |
| Decision       | Phase 3: `decided`, `deferred`, `superseded` | Unchanged; decisions keep their Phase 3 operations                                                                                                                 |
| Recommendation | Client response through a Phase 3 approval   | Unchanged                                                                                                                                                          |
| Opportunity    | `realized`, `declined`, `lapsed`             | `lapsed` is suggested by a signal when the window has closed                                                                                                       |

Resolution changes the working copy. When the record is client-visible, the resolving user can publish the new version in the same step (if they hold `publish_architecture`); otherwise it waits for publication like any other change.

### 7.3 History over time

`intelligence_status_changes` records every change to: status, probability, impact, confidence, validation status, value, feasibility, blocking, negotiable, attention and category. Each row carries who, when, the operation (or "edit") and the rationale when one was given.

- **Internally,** each record shows a timeline; risks and opportunities show their grid position over time; the register can be viewed "as of" a date.
- **Clients** see history only through published versions (Phase 3 history), never the working history.
- **Baselines** already pin versions, so the state of intelligence at a baseline is exact.

---

## 8. Client actions

### 8.1 What an action is

A client action is **one request from TPLCo to one named client member** about the engagement. Kinds (closed set):

| Kind                  | Asks the client to                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `question`            | Answer a question                                                                              |
| `information_request` | Provide information or a document (a link now; a file when uploads exist, D12)                 |
| `confirmation`        | Confirm or correct something, typically an assumption or a fact about the organization         |
| `review_request`      | Review a published element and respond with comments (not an approval; approvals stay Phase 3) |
| `executive_attention` | Give executive attention to an escalated record (§7.1)                                         |

Approvals and decisions remain Phase 3 records with their own responses. The client **Actions** tab shows them together with client actions, so "what is required from us" (spec §7) is one list.

### 8.2 Lifecycle

`open` → `responded` → `closed`, with `returned` (TPLCo asks for more; back to open with a note) and `withdrawn` (TPLCo cancels an open request). **Overdue** is derived from `due_on` in the business time zone, never stored. Every transition is an operation, logged, and shown in the action's history.

### 8.3 Who sees an action

- **TPLCo:** internal members who can read the engagement's architecture.
- **Client:** the addressee; and client members holding `assign_client_actions` (by default the Executive Sponsor and Client Project Lead), who see all the engagement's actions and can reassign them. Client Viewers and Client Finance see none unless one is addressed to them, which `send_client_action` refuses unless they hold `respond_to_client_actions`.
- **Subjects** must be published and client-visible, and within the addressee's areas, when the action is sent. A client sees the subject only as its published snapshot.

### 8.4 Responses become evidence deliberately

A response is the client's own words. TPLCo may record it as an **evidence source** with `client_source` provenance (internal by default), and cite it on a statement. Nothing becomes evidence automatically, and the response keeps its link to the evidence it produced.

### 8.5 Client contributions

A client member with `submit_client_input` may add input to a **published element in their areas** (for example, a correction to a capability's current state). A contribution is received by TPLCo, which either incorporates it (a statement or evidence, with `client_source` provenance) or acknowledges it with a note. The contributor sees the handling note. Contributions never edit the architecture directly.

---

## 9. Per-area participation for Client Contributors

### 9.1 Areas

An area is one of:

- **A domain** (Knowledge, Capability, Strategic Model or Application): every published, client-visible object in that domain.
- **An element and everything under it:** the element and its `part_of` descendants (for example, one capability and its sub-capabilities, or one operating model and its parts).

A Project Intelligence record falls inside a member's areas when any element it concerns (through `underpins`, `threatens`, `constrains`, `mitigates`, `affects`, `addresses`, `advances` or the dependency's from/to) is inside them, or when it spans a domain they are assigned. Engagement-wide records fall inside no area unless assigned directly (D2).

### 9.2 Who is area-scoped

A new client capability, `view_full_architecture`, means "see the whole published, client-visible architecture". By default the Executive Sponsor, Client Project Lead and Client Viewer hold it; the **Client Contributor does not** (D1). A client member with `view_architecture` but without `view_full_architecture` sees only their areas, in:

- the Architecture area, element pages, connected architecture (both ends must be visible, as in Phase 3) and client domain views;
- the Decisions tab (approvals and decisions on elements in their areas);
- client actions (they can be addressed only within their areas) and contributions.

Domain maturity states stay visible to every client member, as in Phase 3. The rule lives in one database helper used by every client policy, so it cannot be bypassed from the UI.

### 9.3 Who assigns areas

TPLCo only, consistent with the Phase 1 rule that clients do not manage access. By default, those who manage the engagement team (Principal Architects, System Administrators and assigned Project Administrators), D8.

---

## 10. Experience

### 10.1 Internal

- **Intelligence home** (per engagement): counts that need judgment (untriaged, escalated, reviews overdue, open client actions, open signals); the seven registers as tabs; the risk and opportunity grids.
- **Registers:** filters (§5.2), default order (§5.3), inline triage, and resolution with rationale. Cross-engagement registers at `/internal/intelligence` for TPLCo staff, limited to engagements they can read.
- **Record page** (the Phase 3 element page, extended): stewardship, escalations, status timeline, open client actions and contributions, and the **impact trace**.
- **Element pages and domain workspaces:** a "Bearing on this element" panel grouping records by relationship; risk and opportunity overlays on the capability map and operating model outline.
- **Client actions:** compose (kind, addressee restricted to eligible members, subjects restricted to published client-visible elements in the addressee's areas, due date); the action list per engagement; response handling and "record as evidence".
- **Contributions inbox** per engagement.
- **Contributor areas** on the engagement team page.
- **Signals** panel, per engagement and on the Reviews page.

### 10.2 Client

- **Overview:** "What is required from us" (spec §7): counts of open actions, approvals and decisions for the viewer, and the domain states.
- **Actions tab** (goes live): the viewer's queue (client actions, approvals, decisions); for Sponsor and Lead, the whole engagement's actions with reassignment.
- **Architecture tab:** the Phase 3 tables stay, with domain views added from published snapshots only:
  - **Knowledge:** the knowledge map (knowledge areas and concepts by `part_of` and `specializes`), research questions and the system boundary;
  - **Capability:** the capability map with tier and readiness, and the role × skill matrix;
  - **Strategic Model** and **Application:** the same views as internal where the snapshot carries the needed attributes (D10).
    Every view reads only snapshots and client relationships; a test proves no internal attribute or working copy reaches them.
- **Project Intelligence** in the Architecture tab: published records by kind, with status as published, and the risk grid for holders of `view_full_architecture`.
- **Element page:** "Add input" for members with `submit_client_input` in their areas, and their past contributions with TPLCo's handling notes.

The design stays calm and typographic, with no badges-as-gamification, progress bars or boards.

---

## 11. Intelligence signals (preparing for Architecture Intelligence)

Signals are named, deterministic rules evaluated by a read model. They are **system-derived**, internal, and advisory: a signal never changes a record. Each has a rule key, a plain explanation, the elements concerned and a suggested next step.

Proposed rules (D11):

| Rule key                                     | Fires when                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| `assumption_unvalidated_underpins_published` | An unvalidated or validating assumption underpins a published element                   |
| `assumption_invalidated_still_underpins`     | An invalidated assumption still underpins an active element                             |
| `risk_high_without_mitigation`               | Severity ≥ 15 and nothing `mitigates` it                                                |
| `dependency_blocking_unsatisfied`            | A blocking dependency is open, at risk or broken and its dependent element is published |
| `decision_past_needed_by`                    | An open or recommended decision is past its `needed_by` date                            |
| `opportunity_window_closing`                 | An opportunity's window closes within 30 days and it is not being pursued               |
| `opportunity_window_closed`                  | The window has closed and the opportunity is not resolved (suggests `lapsed`)           |
| `review_overdue`                             | `next_review_on` has passed                                                             |
| `client_action_overdue`                      | An open client action is past its due date                                              |
| `record_untriaged`                           | A record has been untriaged for more than 7 days                                        |

Preparation for later AI, without AI:

- Every signal and dismissal is structured (rule key, elements, reason), so later analysis can learn from what architects dismissed and why.
- A future AI finding will be stored, not computed, with `ai_analysis` provenance and the Phase 3 review gate; it will appear in the same panel, clearly labeled, and reach no client without review.
- Client responses and contributions arrive with `client_source` provenance and explicit links, so every later summary can be traced to its source.

---

## 12. Capabilities and RLS

### 12.1 New capabilities (enum values; defaults in `role_capability_defaults`)

| Capability                  | Side     | Meaning                                                                          | Default holders                                                        |
| --------------------------- | -------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `manage_client_requests`    | internal | Send, return, close and withdraw client actions                                  | Principal Architect, Architect, Researcher, Project Administrator (D6) |
| `view_full_architecture`    | client   | See the whole published, client-visible architecture rather than assigned areas  | Executive Sponsor, Client Project Lead, Client Viewer (D1)             |
| `respond_to_client_actions` | client   | Be addressed by and respond to client actions                                    | Executive Sponsor, Client Project Lead, Client Contributor             |
| `assign_client_actions`     | client   | See all the engagement's client actions and reassign them within the client team | Executive Sponsor, Client Project Lead                                 |
| `submit_client_input`       | client   | Submit contributions on published elements in their areas                        | Executive Sponsor, Client Project Lead, Client Contributor             |

Triage, resolution, escalation to the Principal Architect, contributions handling and signal dismissal use `edit_architecture`. Client-executive escalation and risk acceptance use `publish_architecture`. Capability overrides stay TPLCo-only; architecture authority stays Principal-granted (Phase 3 decision). Who grants the new client capabilities: those who manage the engagement, as for other non-financial capabilities.

### 12.2 Row-level rules

- **Phase 3 rules are unchanged** for internal readers. `element_client_readable` gains the area check for members without `view_full_architecture`, so every client policy (versions, relationships, approvals, baselines, decisions) inherits it.
- **Stewardship, status history, escalations, signal dismissals, contributor areas (other members'):** internal readers only. A client member reads their own areas.
- **Client actions, subjects and responses:** internal readers; the addressee; holders of `assign_client_actions`. Suspension removes access at once.
- **Client contributions:** internal readers; the contributor; holders of `assign_client_actions` see their team's contributions.
- **Writes:** only through the operations in §6.5. No client user writes any architecture table.
- **Anonymous callers:** nothing.

---

## 13. Test strategy

**pgTAP** (new files):

- `12_intelligence_registers`: opportunity creation, codes and rules; the new relationship pairings (allowed and refused); category keys; stewardship created with each record and invisible to clients; status history written for every tracked field; resolution per kind with required rationale; reopen; risk acceptance needs `publish_architecture`; resolution-with-publish produces a version; the snapshot carries opportunity fields; no finance foreign keys.
- `13_client_actions`: send validation (eligible addressee, published client-visible subjects in areas, `ACT` codes); visibility per role (addressee, Sponsor, Lead, Viewer, Client Finance, other client organization, anonymous); respond, reassign, return, close, withdraw; overdue derived; responses immutable; recording as evidence produces `client_source` evidence and keeps the link; contributions and their handling.
- `14_contributor_areas`: a Contributor sees only their areas across versions, relationships, approvals, decisions, baselines, domain views and actions; domain and element-subtree areas; records inside and outside areas; engagement-wide records; `view_full_architecture` override; suspension; only area managers assign.
- `15_escalation_and_signals`: both escalation levels, acknowledgement and resolution; client escalation requires a published client-visible record and sends an `executive_attention` action; each signal rule fires and clears; dismissals and expiry; signals invisible to clients.
- `99_intelligence_concurrency`: two sessions sending actions get distinct `ACT` codes; two responders on one action; concurrent resolution of one record.
- Existing suites keep passing; `07_architecture_access` is updated where the Contributor default changes (D1).

**Vitest:** the opportunity vocabulary and new relationship rules mirror the migration; category lists mirror the reference table; register filter parsing and default ordering; client domain view adapters use snapshot data only; signal labels complete.

**Playwright:**

1. An Architect triages new records, sets attention and next review, filters the risk register and resolves a dependency with a rationale.
2. An Architect creates an opportunity, links it with `advances` and `pursues`, and publishes it.
3. An Architect escalates a risk to the Principal Architect, who acknowledges and resolves it; a Principal escalates a published risk to the client executive, and the Sponsor sees it in Actions.
4. An Architect sends a confirmation to the Client Contributor about an assumption in their area; the Contributor responds; the Architect records the response as evidence and validates the assumption.
5. The Client Contributor sees only their areas: an element outside them returns 404; the Project Lead sees everything and reassigns an action.
6. A Contributor submits input on a published capability; TPLCo incorporates it.
7. The client sees the Knowledge map and Capability matrix built from published snapshots, and not a later working-copy edit.
8. Client Viewer and Client Finance have no actions and cannot respond.
9. Phase 1, 2 and 3 suites re-run.

**Seed:** Meridian gains two opportunities, triage on every record, a status history for one risk and one assumption, one Principal-level and one client-executive escalation, client actions in each state (one overdue), a contribution, and a Capability-domain area for `contributor@meridian.test` (and one element area for `advisor@consulting.test`).

---

## 14. Relationship to later phases

- **Phase 5** (reviews, deliverables, implementation): an Executive Review agenda can pull escalated records, open decisions and signals; implementation tracking will link to elements, not to client actions.
- **Phase 6** (Method Library): controlled categories and resolved records are the raw material for anonymized patterns; nothing client-confidential is copied.
- **Phase 7** (Architecture Intelligence): AI findings enter as stored, reviewed signals and statements; client responses and contributions give it well-provenanced client input.
- **Phase 8** (Portfolio Intelligence): recurring risks, recurring capability gaps and resolution times become computable from controlled categories and status history.

---

## 15. Difficult-to-reverse decisions

| #   | Decision                                                                                            | Why it is hard to reverse                                                                                |
| --- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | **Opportunity as a record kind on the element spine** (§4)                                          | `element_kind` enum value; reference codes (`OPP`); relationships and snapshots key on it                |
| 2   | **`advances` and `pursues` relationship types** (§4.2)                                              | Part of the Method's vocabulary as software; removing a type means rewriting links                       |
| 3   | **Contributor visibility narrowed by `view_full_architecture`** (§9)                                | Changes what existing Contributors see; the capability value is permanent                                |
| 4   | **Areas defined as domains or `part_of` subtrees** (§9.1)                                           | Every client policy depends on the area helper                                                           |
| 5   | **Client actions addressed to engagement members, with `ACT` codes and a closed set of kinds** (§8) | Clients will cite action codes; responses and evidence link to them                                      |
| 6   | **Stewardship is internal and unversioned** (§5.1)                                                  | Decides that attention and review dates never reach clients                                              |
| 7   | **Controlled categories** (§6.2)                                                                    | Portfolio comparison later depends on stable keys; data is migrated off free text                        |
| 8   | **Append-only status history** (§7.3)                                                               | Clients and later analysis compare states over time; history cannot be reconstructed honestly afterwards |
| 9   | **`risk_status` gains `materialized`** (D4)                                                         | Enum values are permanent                                                                                |
| 10  | **New capability enum values** (§12.1)                                                              | Permanent                                                                                                |
| 11  | **Signals computed, dismissals stored** (§11)                                                       | Sets how later AI findings sit beside rule-based ones                                                    |

Each will get an ADR (0026 onward) with the build.

---

## 16. Decisions (approved 2026-09-30)

Kerrick approved the proposal on 2026-09-30 with no changes. Each decision below is settled as its recommendation. For D8, the recommended option (those who manage the engagement team) applies.

| #   | Question                                                                                                                                                                                                | Outcome (the recommendation, approved)                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Narrow Client Contributors to assigned areas through a new `view_full_architecture` capability (Sponsor, Lead and Viewer hold it; Contributor does not)? This changes Phase 3 behavior for Contributors | **Yes.** It matches spec §4 and your Phase 1 target ("Contributor: assigned areas")                                                                                                         |
| D2  | Should engagement-wide records be visible to area-scoped Contributors?                                                                                                                                  | **No**, unless assigned directly. Engagement-wide risks (for example leadership succession) can be sensitive                                                                                |
| D3  | Approve the Opportunity vocabulary (§4) and the controlled category lists (§6.2)?                                                                                                                       | Approve, with any wording changes you want                                                                                                                                                  |
| D4  | Add `materialized` to risk status?                                                                                                                                                                      | **Yes.** A risk that occurs should stay visible as such rather than be closed                                                                                                               |
| D5  | Give client actions permanent `ACT-nnn` reference codes?                                                                                                                                                | **Yes**, so clients and TPLCo can cite them                                                                                                                                                 |
| D6  | Who sends client actions (`manage_client_requests`)?                                                                                                                                                    | Principal Architect, Architect, Researcher and Project Administrator                                                                                                                        |
| D7  | Client capability defaults (§12.1): Contributors respond and submit input; Sponsor and Lead also reassign; Viewers and Client Finance do neither?                                                       | **Yes**                                                                                                                                                                                     |
| D8  | Who assigns Contributor areas?                                                                                                                                                                          | Those who manage the engagement team (Principal Architects, System Administrators, assigned Project Administrators). Alternatively Principal Architects only, as for architecture authority |
| D9  | Escalation levels: Principal Architect and client executive only?                                                                                                                                       | **Yes.** More levels would start to become a workflow engine                                                                                                                                |
| D10 | Client domain views: Knowledge and Capability (required), plus Strategic Model and Application?                                                                                                         | **Include all four.** The views exist internally; the client versions read snapshots only                                                                                                   |
| D11 | Approve the signal rules (§11) and their thresholds (severity ≥ 15, 30-day window, 7 days untriaged)?                                                                                                   | Approve; thresholds are constants that can change without a migration                                                                                                                       |
| D12 | Build file upload for information requests and evidence in Phase 4 (private Supabase Storage bucket, engagement-keyed paths, RLS-tested), or keep HTTPS links only?                                     | **Include it.** Information requests are weak without files, and it is already a pre-production requirement                                                                                 |

---

## 17. Build order once approved

1. ADRs 0026 onward for §15.
2. Enum migration (`opportunity`, `materialized`, capabilities), then the Project Intelligence migration: categories, opportunities, stewardship, history, escalations, client actions, contributions, areas, signal dismissals, relationship rules, guards, RLS, operations and read models.
3. pgTAP suites (§13) and seed.
4. Domain layer: vocabulary regeneration, schemas, queries, actions, signal labels.
5. Internal experience: registers, record pages, escalation, client actions, contributions, areas, signals.
6. Client experience: Actions tab, area-scoped views, domain maps and matrices, contributions.
7. Playwright run-through across roles, docs (`docs/database/intelligence.md`), README and the end-of-phase report.

As before, each step is checked locally and in CI, and the end-of-phase report comes before the merge.
