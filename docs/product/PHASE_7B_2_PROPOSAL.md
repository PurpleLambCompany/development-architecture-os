# Phase 7B.2 Proposal — Architecture Intelligence Experience

**Status:** proposal only, Revision 1, 2026-10-01, for Kerrick's review. Nothing here is implemented. No migration, application code, credential, provider call, dependency or evaluated-model change accompanies it, and the Phase 7B.2 hold in `CLAUDE.md` stays until Kerrick approves implementation.

**Built on:** `main` at `0e6e313` (Phases 1 to 7B.1 merged) and [`PHASE_7B_2_INTELLIGENCE_EXPERIENCE_RECONCILIATION.md`](PHASE_7B_2_INTELLIGENCE_EXPERIENCE_RECONCILIATION.md) Revision 2, whose decisions IX-1 to IX-26 and principles 22 and 23 govern this document. Earlier decisions are cited by their own numbers (B-n, OD-n). Open decisions in this proposal are numbered **PD-1** to **PD-22** and collected in §35.

---

## Reading guide

| If you want…                           | Read                 |
| -------------------------------------- | -------------------- |
| The whole proposal in two minutes      | §1                   |
| What a person sees                     | §3, §6, §7           |
| When AI becomes available at all       | §5 (activation gate) |
| The deterministic surfaces             | §7, §8               |
| Where AI actions appear, and why       | §9                   |
| How interpretations persist and return | §14 to §17           |
| Judgment and the Edge                  | §18 to §20           |
| Schema and migrations                  | §27                  |
| Tests and acceptance                   | §30 to §32           |
| What needs Kerrick's answer            | §34, §35             |

---

## 1. Executive summary

Phase 7B.2 makes Architecture Intelligence something an architect can use, without changing what 7B.1 made safe.

**One pattern, everywhere:** the **intelligence drawer**. It opens from a governed object that has a deterministic reason to be interpreted, and it always has three layers in the same order:

1. **What DSA knows.** A deterministic assembly that is complete and useful on its own, for everyone who can read the architecture, with AI off.
2. **Interpretation.** Shown only to holders of `use_architecture_intelligence`, only where a deterministic availability rule says it is relevant, and generated only when the person asks. Labelled `suggested`, cited to exact versions, with stated uncertainty. It may say there is **nothing consequential to add**.
3. **Judgment.** The person's attributed judgment on the deterministic item and, separately, on a kept interpretation; promotion only through the existing governed operations.

**The flagship is Prepare:** a deterministic **Review dossier** built from the examined-version capture, with an optional `review_brief` interpretation.

**Other interpretations** use the five existing kinds on their existing subjects, under these interface verbs:

| Interface verb       | Kind                  | Subject                                       |
| -------------------- | --------------------- | --------------------------------------------- |
| Explain significance | `explanation`         | Edge item, substantive revision, impact trace |
| Examine tension      | `tension`             | A connected pair of elements                  |
| Examine bearing      | `evidence_bearing`    | An evidence link                              |
| Compare with intent  | `realization_reading` | An Implementation Initiative                  |
| Prepare              | `review_brief`        | A Review                                      |

No new inference kinds and no new Tool Contract functions.

**Interpretations are ephemeral unless a person keeps them** (IX-12 refinement). Keeping is an explicit act, or the act of judging the interpretation. A kept interpretation:

- enters the judgment lifecycle;
- is reused while its basis, prompt and model are unchanged (IX-13);
- is suppressed after `not_material` or `disagree` until its basis changes (IX-14);
- for `tension`, `evidence_bearing` and `realization_reading`, appears in a **Suggested interpretations** section of the Engagement Edge, outside the tiers, for capability holders only (IX-17, IX-18).

**Activation gate (IX-1).** The implementation can be built, tested and browser-accepted with a deterministic fake provider in non-production environments. Enabling any kind for real use requires its governed seed-only real-model evaluation, manual grading, committed report and reviewed manifest change. Until then, holders see the governance state "not yet available", and every deterministic surface works as normal.

**Schema:** six migrations, all additive. They add:

- one append-only judgment table;
- one outcome value and one request flag;
- a keep operation;
- read models for availability, reuse, suggested interpretations, the Review dossier and supports and exposures;
- staleness and suppression helpers.

No change to `edge_items`, the rule catalog, client policies or the Tool Contract.

---

## 2. Goals and non-goals

### 2.1 Goals

1. Make the five approved interpretations usable from the objects they concern, through one standard drawer.
2. Ship deterministic surfaces (Review dossier, "Why am I seeing this?", supports and exposures, realization facts) that are useful with AI completely unavailable (principle 22).
3. Offer AI actions only where a deterministic rule makes them relevant, and say why (principle 23).
4. Persist only what a person chooses to bring into the governed interpretation lifecycle (IX-12).
5. Let Architecture Intelligence be silent (IX-15).
6. Give inferences a judgment lifecycle equal to Edge items, without contaminating the Edge (IX-17, IX-19).
7. Keep every 7B.1 guarantee: no mutation of governed state, minimum-sufficient context, re-check before every send, evaluated models only, metadata-only audit.

### 2.2 Non-goals (each preserves a decision)

Generic chat (IX-6); Challenge mode or kind (IX-5, IX-9); whole-development Read and interpreting the Development Brief (IX-10); arbitrary multi-object interrogation (IX-8); command surface (IX-24); proactive or background inference (IX-16, B-25); client AI (IX-21); Method-aware AI (IX-22); Development Context in requests (IX-23); web search (B-17); file or image processing (B-16); embeddings and vector stores; Development Environment Intelligence (B-18); MCP (B-20); autonomous promotion and AI promotion suggestions (IX-20); AI ranking or scoring; AI dashboards; notifications (B-27); interpretation in the engagement overview or the "since you last reviewed" briefing (IX-17).

---

## 3. What 7B.2 delivers, as a person experiences it

Reference codes below are illustrative.

**Prepare a Review (Principal Architect).** Opening REV-003, the architect sees a new **Dossier** section above the agenda. It lists:

- each examined element at its captured version, with what has substantively changed since;
- evidence linked since;
- open Edge items on those elements;
- criteria in force;
- implementation changes;
- decisions and escalations due.

With AI off, this is the whole experience, and it is enough to run the meeting. With AI available, a **Prepare interpretation** action sits beside it. The brief appears in the drawer as at most eight points, in the order of the examined set, each citing dossier records. The architect clicks **Keep for this Review**, so the other architects on the engagement see the same brief, and it goes stale when anything it read changes.

**Explain an Edge item (Architect).** On the Edge, "Architecture changed after implementation validation" offers **Explain significance** because its trigger is a substantive revision. The drawer shows the envelope first: rule, trigger versions, changed paths, consequence path, resolving act. The interpretation explains how the changed scope statement bears on what was validated. The architect reads it, does not keep it, and judges the Edge item `investigating`. Nothing about the interpretation is stored except the metadata-only audit row.

**Compare with intent (Principal Architect).** An initiative with published `implements` targets and recorded checkpoints offers **Compare with intent**. The readings say one target appears to correspond and one has not enough recorded. The architect keeps it, so it appears under Suggested interpretations on the Edge. Later they judge it `not_material` with a reason, and it leaves the section and is not offered again until the initiative or its targets change.

**Nothing to add.** Asked to examine the bearing of an evidence link whose summary says little, the drawer shows: "DSA's records do not support an interpretation of this." It gives the model's one-line reason, labelled as such. Nothing is kept.

**A Researcher without the capability** sees the same dossiers, envelopes and facts, and no AI action, interpretation, count or hint that any exist.

---

## 4. Governing principles applied

From the reconciliation (Appendix A, as amended in Revision 2), the ones that shape design decisions here:

| Principle                                                 | Where enforced                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------ |
| 16. Deterministic first, complete on its own              | Drawer layer order (§6); layer 1 assemblies (§7, §8)                     |
| 17. Interpretations expire with their basis               | Computed staleness (ADR-0064); stale UX (§21)                            |
| 18. Same question, same answer while nothing has changed  | Reuse (§16)                                                              |
| 19. Permission shapes context                             | Unchanged Tool Contract and authorisation (ADR-0060, -0063)              |
| 20. No intelligence about people                          | No per-person views; register lists records, not people's activity (§26) |
| 21. Failures speak governance                             | §23                                                                      |
| **22. Deterministic surfaces useful with AI unavailable** | §7, §8, §30.3 (tests with AI off), §31 (browser pass with AI off)        |
| **23. Interpretation availability is itself explainable** | §9 availability rules, each with a reason shown to the person            |

---

## 5. Activation and evaluation gate (IX-1)

### 5.1 Two separate approvals

| Step                                  | What it is                                                                                                                                                         | Approved by                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| **A. 7B.2 implementation acceptance** | Everything in this proposal is built and tested. Interpretation paths are exercised end to end with the deterministic fake provider in non-production (§5.3)       | Kerrick, on PR (as every phase)     |
| **B. Kind activation** (one per kind) | Seed-only real-model evaluation of that kind's current prompt, manual grading, committed metadata-only report, reviewed manifest change adding the evaluated model | Kerrick, on a separate PR per batch |

Step A never makes a real model's output reachable. Step B changes no code path; it adds a manifest entry, which the Gateway already requires (OD-8). Neither needs the other to be useful: Step A ships the deterministic surfaces to real engagements; Step B turns on interpretations for synthetic engagements, and for real ones only once B-4's contractual prerequisites are met and the mode is `enabled`. (PD-1)

### 5.2 What a kind needs to be offered

An interpretation action is shown only when **all** hold (computed per request, server-side):

1. `ARCHITECTURE_INTELLIGENCE_MODE` is not `off`, and is `enabled` or the engagement is synthetic;
2. the viewer holds `use_architecture_intelligence` on the engagement;
3. the engagement is `proposed` or `active` and currently authorised for every class the kind's plan requires;
4. the kind's current prompt version lists at least one evaluated model for the configured provider and requested model;
5. the deterministic availability rule for that action holds on that subject (§9).

If 1 to 3 hold but 4 does not, holders see the governance state "Not yet available: no model has been evaluated for this kind of interpretation" in layer 2, and no action. If 1 or 3 fails, holders see the matching governance state. If 2 fails, nothing is shown (IX-18).

### 5.3 The fake provider for acceptance (PD-2)

7B.1's `FakeModelAdapter` is used by tests and the harness. For browser acceptance of Step A, the server may use it when **all** of these hold:

- `ARCHITECTURE_INTELLIGENCE_PROVIDER=fake`;
- `ARCHITECTURE_INTELLIGENCE_MODE=synthetic_only`;
- `NODE_ENV` is not `production`.

A test-only manifest overlay, loaded only under those conditions, lists `dsa-fake-model-1` as evaluated for the v2 prompts. The production build refuses the `fake` provider outright, and a test proves the overlay cannot load in production. The fake returns deterministic, schema-valid outputs per kind, including "nothing to add" and invalid-output cases. That lets browser acceptance show every state honestly, without a credential or a provider call.

---

## 6. The standard intelligence drawer

### 6.1 Anatomy

```
┌ Drawer ─────────────────────────────────────────────────────────┐
│ Subject line   CAP-004 · Capability · v3 published 12 Sept       │
│ Question       "Explain significance"           [Close]          │
├─────────────────────────────────────────────────────────────────┤
│ 1  WHAT DSA KNOWS                                                │
│    deterministic assembly for this question (§7)                 │
├─────────────────────────────────────────────────────────────────┤
│ 2  INTERPRETATION · suggested           (capability holders)     │
│    offered because: <availability reason>                        │
│    [Interpret]  or  kept interpretation from 1 Oct · current     │
│    assertion · claims with citations · uncertainty · state       │
│    [Keep]  [Interpret again]  ▸ How this was produced            │
├─────────────────────────────────────────────────────────────────┤
│ 3  JUDGMENT                                                      │
│    on the item: investigating · not material · deferred ·        │
│                 disagree · promote…                              │
│    on the interpretation (kept only): same kinds                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Rules

1. **Fixed order.** Layers appear 1, 2, 3 on every surface and device. Layer 1 is never collapsed by default.
2. **Layer 1 is complete.** It never says "interpret to see more". It reads as finished information.
3. **Layer 2 is typographically distinct and calm.** It has a label ("Interpretation · suggested"), a muted rule, and citations as reference codes with versions. No colour coding of severity, no icons implying alert, and never styled like a governed record or Edge item.
4. **Layer 2 is absent** for people without the capability: no heading, placeholder or count (IX-18).
5. **Layer 3 separates its two judgments.** Judging the deterministic item never judges the interpretation, and the reverse (7B §15.3).
6. **Opening the drawer never calls the model.** It may read a kept, current interpretation (reuse, §16); generating requires **Interpret**.
7. **One drawer at a time.** Opening another subject replaces the content; the URL carries the drawer state so it can be linked and reloaded.
8. **The drawer is server-rendered** from read models and the Gateway's results; no inference text is cached in the browser beyond the open drawer and the keep token (§14.3).

### 6.3 Where the drawer opens from

| Surface                                    | Subject(s)                                                                         |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Engagement Edge and contextual Edge panels | Edge item                                                                          |
| Element page                               | Substantive revision; impact trace; related element (pair); supports and exposures |
| Evidence page and element evidence lists   | Evidence link                                                                      |
| Review page                                | Review (dossier and Prepare)                                                       |
| Implementation Initiative page             | Initiative (realization facts and Compare with intent)                             |
| Engagement Edge, Suggested interpretations | A kept inference (opens its subject's drawer)                                      |
| Architecture Intelligence page register    | A kept inference                                                                   |

---

## 7. Layer 1: deterministic assemblies

Each assembly is a read model (database function or composition of existing ones), returns nothing to clients, and is readable by everyone with `can_read_architecture` on the engagement. None calls the Gateway.

| Subject                         | Assembly                                                                                                                                                                                                                                                          | Source                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Edge item                       | **Why am I seeing this:** rule name and definition; lens; trigger (what changed, versions, when); basis records; consequence path with direction and propagation; tier and its reason; resolving act; current judgment                                            | `edge_items` envelope, `edge_rule_catalog` (existing)                              |
| Substantive revision            | From and to versions; changed paths with before and after statement text; status publications between them listed separately; approvals and baselines touching either version                                                                                     | `element_revisions`, `element_versions` (existing)                                 |
| Impact trace                    | Reached records with path, relationship types, direction, propagation and depth; reached records' current Edge items                                                                                                                                              | `impact_trace`, `edge_items` (existing)                                            |
| Element: supports and exposures | Supporting and contradicting evidence (stance, date, summary presence); Assumption records that `underpin` it and whether each has supporting evidence; open Risks related to it; Edge items on it                                                                | New read model `element_supports_and_exposures` (§27); deterministic, no AI (PD-9) |
| Related pair                    | Both elements at current versions; the relationship(s) or impact path between them; each side's latest substantive revision date; Edge items whose basis includes both                                                                                            | Existing relationships, `element_revisions`, `edge_items`                          |
| Evidence link                   | Evidence source metadata (title, kind, date, `ip_classification`, whether a summary is recorded), stance, linked statement or element at current version, when linked, and by whom only for internal readers already allowed to see it                            | Existing evidence tables                                                           |
| Review                          | **Review dossier** (§8)                                                                                                                                                                                                                                           | New read model `review_dossier` (§27)                                              |
| Implementation Initiative       | **Realization facts:** status and history; checkpoints (target, achieved, missed); `implements` targets at published versions with their latest substantive revision; criteria in force and their agreement state; validation captures; implementation Edge items | Existing initiative read models, `edge_items`                                      |

**Proof of usefulness with AI off (principle 22).** Each assembly has a Vitest render test and a browser acceptance step with `ARCHITECTURE_INTELLIGENCE_MODE=off`, and with a viewer who lacks the capability. Each must show the full layer 1 with no AI wording, no empty layer 2 and no error (§30.3, §31).

---

## 8. The deterministic Review dossier

### 8.1 Contents, in order

For Review _R_ on engagement _E_ (scheduled or held):

1. **Examined set.** Each element _R_ `examines`:
   - **Held:** the captured version from `review_examined_versions`.
   - **Scheduled:** the current published version, labelled "will be examined at the hold".
2. **Changes since.** Per examined element:
   - **Held Review:** substantive revisions after the captured version, from `element_revisions`, with changed paths. Status publications are listed separately.
   - **Scheduled Review:** substantive revisions since the most recent earlier held Review that examined the same element. If there is none, it says "first Review of this element".
3. **Evidence since.** Evidence links on examined elements (statement or element links) created after the comparison point, with stance.
4. **Edge conditions.** Current, unjudged Edge items whose subject or trigger subject is an examined element, in tier order (ADR-0058). Judged items are counted ("3 judged") and listed on expansion.
5. **Acceptance criteria.** For initiatives that `implements` an examined element:
   - criteria in force;
   - criteria proposed, agreed, superseded or withdrawn since the comparison point.
6. **Implementation.** For those initiatives: status transitions, and checkpoints achieved or missed since the comparison point.
7. **Unresolved matters.** Items whose governance date falls on or before the Review's date:
   - open decisions due;
   - open escalations on examined elements or their initiatives;
   - deferred Edge items whose date has passed or falls before the Review.

### 8.2 Properties

- **Exact.** Every line names records with versions; nothing is summarised.
- **Ordered by the examined set as recorded**, then by time. No importance ordering.
- **Internal.** Clients continue to see only their published Review snapshot.
- **Stable enough to cite.** The dossier's records are exactly what `review_brief` receives as anchors (via `get_review_context` and anchors already in the 7B.1 plan). An interpretation can cite only what the person can see in layer 1. (Where the 7B.1 `get_review_context` projection omits a dossier section, the brief cannot cite it; §13.2 lists the alignment.)
- **Free.** No external processing, no audit row, no budget.

### 8.3 Where it appears

A **Dossier** section on the Review page, between Session and Agenda. The existing Agenda keeps its role (participants' working list). On mobile it reads as a single column with collapsible sections (§25).

---

## 9. Availability rules (principle 23)

An AI action appears only when the gate in §5.2 holds **and** its deterministic rule holds. The rule's reason is shown in layer 2 as "Offered because …". Rules are computed by one read model, `public.architecture_intelligence_availability(engagement, subject…)`, so they are testable, identical on every surface and never decided in UI code.

| Action                   | Subject                   | Offered when (all)                                                                                                                                                                                                                                                     | Reason shown (example)                                              |
| ------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Explain significance     | Edge item                 | The item is not Ambient; its subject is an element; and it has a trigger that is a substantive revision **or** a non-empty consequence path. These are the cases where there is a condition to connect to statements                                                   | "CAP-004 changed substantively after IMP-002 was validated"         |
| Explain significance     | Substantive revision      | The revision is substantive (ADR-0053) and changes at least one statement path                                                                                                                                                                                         | "v3 changed purpose and scope statements"                           |
| Explain significance     | Impact trace              | The trace reaches at least one element beyond the start, through a propagating relationship                                                                                                                                                                            | "Changing STM-002 reaches 4 elements through underpins and enables" |
| Examine tension          | Related pair (A, B)       | A and B are connected by a typed relationship (or within the governed impact path), both have published statements, **and** either an Edge item's basis or consequence path includes both, or one side's latest substantive revision is later than the other's (PD-11) | "STM-002 was revised after CAP-004, which it underpins"             |
| Examine bearing          | Evidence link             | The link is current; its element is not retired; and the evidence source has a recorded summary. Without a summary, metadata alone cannot support a reading (PD-12)                                                                                                    | "Evidence linked 20 Sept with stance supports; summary recorded"    |
| Compare with intent      | Implementation Initiative | The initiative `implements` at least one published element, and has at least one checkpoint or a status beyond its initial status                                                                                                                                      | "Implements 2 published elements; 3 checkpoints recorded"           |
| Prepare (interpretation) | Review                    | The Review is scheduled or held and examines at least one element                                                                                                                                                                                                      | "Examines 5 elements; 2 changed since the hold"                     |

**Suppression (IX-14)** is part of availability: if a kept inference of the same kind on the same subject is current and its latest judgment is `not_material` or `disagree`, the action is replaced by "You judged this interpretation not material on 1 Oct" with **Interpret again** (deliberate, audited).

**Reuse (IX-13)** is part of availability: if a reusable kept inference exists (§16), the drawer shows it, and the action becomes **Interpret again**.

**Clutter rule.** Lists show no AI affordance per row. Actions appear inside the drawer, and on detail pages beside the deterministic section they extend (one action per section at most).

---

## 10. Explain significance (`explanation`)

- **Subjects:** Edge item, substantive revision, impact trace (unchanged from 7B.1).
- **Anchors:** unchanged (7B.1 plans).
- **What it adds** beyond layer 1: how the condition, change or trace connects to the subject's governed statements, citing them.
- **What it must not do:**
  - restate the condition;
  - say whether it applies;
  - rate importance;
  - suggest suppression or a judgment.
- **Persistence:** ephemeral; kept only by Keep or by judging it (§15).
- **Projection:** none (IX-17). A kept explanation shows inside its subject's drawer only.

## 11. Examine via existing kinds

### 11.1 Examine tension (`tension`)

- Subject: an ordered pair. The drawer offers it from the element page's related-elements list, the impact trace's reached records, and an Edge item whose basis includes both.
- Ordering of the pair: the element whose page it was opened from is A.
- Payload rendered:
  - the two statements, side by side on desktop and stacked on mobile;
  - "Nature" (model text);
  - "What would establish it" (model text);
  - claims with citations.
- Never called a contradiction; never chooses a side.

### 11.2 Examine bearing (`evidence_bearing`)

- Subject: an evidence link.
- Payload rendered:
  - **Recorded stance**, taken from the record and never from the model;
  - **Apparent bearing**;
  - **Consistent with recorded stance:** yes, unclear or no.
- The honest limit is shown in layer 2: "Read from the recorded summary and metadata only; the evidence file is not read."

## 12. Compare with intent (`realization_reading`)

- Subject: an Implementation Initiative. Label: **Compare with intent** (IX-11). The word "Read" is not used.
- Payload rendered: per `implements` target, the observation and reading (`appears_to_correspond`, `appears_to_diverge`, `not_enough_recorded`) as plain phrases.
- Never implies a status transition, validation or assessment of people.

## 13. Prepare (`review_brief`)

### 13.1 Interaction

**Prepare interpretation** beside the Dossier. The result is in layer 2 of the Review drawer. **Keep for this Review** persists it; kept briefs are visible to all capability holders on the engagement. A newer kept brief supersedes the older one; the older remains in history.

### 13.2 Alignment of the brief's anchors with the dossier

`get_review_context` (7B.1) supplies the following.

| Dossier section        | Supplied by `get_review_context`? |
| ---------------------- | --------------------------------- |
| Examined versions      | Yes                               |
| Revisions since        | Yes                               |
| Open Edge items        | Yes                               |
| Criteria in force      | Yes                               |
| Decisions due          | Yes                               |
| Evidence since         | No                                |
| Implementation changes | No                                |
| Escalations            | No                                |

For those three sections the model may request `get_evidence`, `get_implementation_state` and `get_project_intelligence` (escalation state on records).

`get_evidence` and `get_implementation_state` are **not** in `review_brief`'s 7B.1 permitted tools. Adding them to the plan is a context-plan change. It needs no new Tool Contract function, but the change must be evaluated (PD-13). `published_architecture` stays the only required class. Evidence and implementation rows are withheld, as 7B.1 already does, when their class is not authorised, and the brief then says what it could not see.

## 14. Invocation flow

### 14.1 Steps

1. The person presses an action. The server runs the gate (§5.2) and the availability rule (§9) again. A screen that is out of date cannot invoke.
2. **Large-request warning (IX-25).** If the Gateway's pre-send estimate exceeds half of the per-request ceiling, the person confirms first: "This is a larger request than usual." No currency or budget figures are shown to people who are not authorizers (PD-17).
3. The Gateway runs in **ephemeral** mode (7B.1), with every 7B.1 check:
   - re-check before every send;
   - Tool Contract only;
   - validation;
   - evaluated-model check.
     It writes one metadata-only audit row, with outcome `returned`, `nothing_to_add` or a refusal.
4. The drawer shows the result, with **Keep**, and a keep token (§14.3).

### 14.2 The app never persists on generation

The application path calls the Gateway only in ephemeral mode. The Gateway's 7B.1 `persist` mode remains for the evaluation harness on synthetic engagements only, and a test proves no application module uses it (IX-12).

### 14.3 The keep token (PD-4)

Keeping must persist exactly what the model returned, not text the browser could alter. The server therefore returns, with each ephemeral interpretation, a token:

- **Contents:** an HMAC-SHA-256 over the canonical output, the request id, the engagement, the requester, the basis manifest digests and an expiry 30 minutes after generation.
- **Key:** a new server-only secret, `ARCHITECTURE_INTELLIGENCE_KEEP_SECRET`. This is not a provider credential.
- **On Keep:** the server verifies the token, then calls the keep operation (§27, migration 3).

The keep operation re-verifies in the database, as recording does in 7B.1:

- the context gate;
- the same authorisation as the request;
- every basis row's class and digest, re-emitted through the Tool Contract;
- the claims' handles.

If the basis changed in the meantime, keeping is refused: "This interpretation's basis has changed; interpret again." Nothing durable exists before Keep except the metadata-only audit row.

---

## 15. Persistence intent (IX-12)

### 15.1 The rule

**An interpretation persists only when a person signals that it should enter the governed interpretation and judgment lifecycle.** Two signals count:

1. **Keep** (in the drawer; on a Review, **Keep for this Review**);
2. **Judging an ephemeral interpretation.** The judgment form says "Judging keeps this interpretation", and the keep and the judgment happen in one server action and two database operations, in order (PD-3).

Nothing else persists:

- viewing does not;
- generating does not;
- closing the drawer does not;
- an Edge-item judgment made while an interpretation is open does not.

### 15.2 Who may keep

Only the person who requested the interpretation, with a valid keep token (PD-5). Any capability holder may judge a kept interpretation.

### 15.3 What a kept inference is

The 7B.1 `architecture_inferences` row and its basis, unchanged in shape, with `request_id` naming the earlier `returned` request. A new column records `kept_at` (the time of the keep; generation time stays `requested_at`). The kept inference's provenance therefore shows both when it was generated and when it was kept.

---

## 16. Current-inference reuse (IX-13)

A kept inference **K** is reused for a new request of the same kind on the same subject when all hold:

1. **K**'s subject equals the request's subject (all subject columns, including fingerprint for Edge items and version for revisions);
2. `architecture_inference_state` reports **K** `current`: every basis digest re-emits identically, no basis record removed, no class withdrawn;
3. **K**'s `prompt_version` is the kind's current prompt version;
4. **K**'s `provider_key` and `requested_model` equal the current configuration, and its `resolved_model` is listed as evaluated for that prompt version;
5. **K** is not superseded.

When reuse applies, the drawer shows **K** with its original generation time ("Interpretation from 1 Oct, still current") and **Interpret again**. Reuse does **not** call the provider and writes **no** audit row: nothing leaves DSA. Ephemeral interpretations are never reused (they were not kept). (PD-13 covers the reuse match.)

---

## 17. Nothing consequential to add (IX-15)

### 17.1 Output schema v2

Every kind's output becomes a discriminated union. The current envelope is the "interpretation" branch. A new branch, `{ "result": "nothing_to_add", "reason": string }`, has these rules:

- `reason` is at most 300 characters;
- it carries no claims and no handles.

This needs output schema version 2 and v2 prompts for all five kinds, each instructing the model to prefer silence when the basis does not support a cited interpretation. The v1 prompts are retired, and the new versions must be evaluated (Step B).

### 17.2 Handling

- Request outcome `nothing_to_add`, a new value in the closed set. Its tokens and cost are recorded like any model call.
- Never persisted as an inference; never an Edge item; not keepable; not judgeable.
- Shown as "DSA's records do not support an interpretation of this." The model's reason appears beneath it, labelled "Reason given" (PD-8). Show the reason or not is PD-8.
- **Not** a reuse key. Asking again calls the model again, which is acceptable because the request is deliberate.
- Validation still applies. A `nothing_to_add` reason containing forbidden vocabulary is `invalid_output`.

---

## 18. Inference judgment model (IX-19)

### 18.1 Table

`public.architecture_inference_judgments` is append-only. Columns:

- `engagement_id`;
- `inference_id`, with a same-engagement foreign key to `architecture_inferences`;
- `judgment_kind`: one of `investigating`, `not_material`, `deferred`, `disagree`, `promoted`, a text value with a check;
- `reason`, required except for `investigating`;
- `expires_on`, required for `deferred`;
- the promotion target, using exactly the ADR-0056 closed vocabulary:
  - `promotion_target_kind`: `risk`, `decision`, `review` or `acceptance_criterion`;
  - `promotion_target_element_id`, with an element foreign key and kind check;
  - `promotion_target_criterion_id`;
- `judged_by` and `judged_at`, taken from the session.

It has a guard trigger, and update and delete are refused for every role (`23514`).

### 18.2 Semantics (identical to ADR-0056, producer-neutral)

| Kind            | On a kept inference                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `investigating` | Stays listed; shown as being examined by the person                                                                                                |
| `not_material`  | Leaves Suggested interpretations; suppresses re-offering on the same kind and subject while the inference stays current                            |
| `deferred`      | Leaves Suggested interpretations until `expires_on` or staleness                                                                                   |
| `disagree`      | "The producer is wrong for this case": interpretation feedback, retained as evaluation data. It leaves the list and suppresses like `not_material` |
| `promoted`      | A person completed a governed operation prompted by the inference; names the record; leaves the list                                               |

**Staleness ends suppression.** When the judged inference goes stale (its basis changed), the action is offered again. That is "until the basis changes" (IX-14), computed and never stored.

### 18.3 Operation and capability

`public.record_architecture_inference_judgment(engagement, inference, kind, reason, expires_on, promotion_target_kind, promotion_target_id)` requires:

- `use_architecture_intelligence`, to read the inference (OD-11);
- `edit_architecture`, consistent with Edge judgments (ADR-0056) (PD-6).

It takes an engagement-scoped advisory lock, refuses judging a stale inference (`23514`, "This interpretation is stale"), and for `promoted` re-checks the target as `private.record_edge_judgment_row` does. It is not in `activity_log` (OD-10 extends to the new table, PD-18).

### 18.4 Evaluation data

`disagree` and `not_material` reasons are internal evaluation data about prompts and models (7B §9.3 item 5). They are read by kind, prompt version and resolved model, and never by person (ADR-0066 rule extends).

## 19. Promotion from an inference (IX-20)

- The judgment layer offers the four governed targets deterministically, as on Edge items.
- The model never suggests or ranks a target, and no payload field names one.
- The governed form opens **without model text**. The person may choose **Bring interpretation text** to insert it, and the inserted statement enters as `ai_analysis`, `pending`, under the existing review gate (`review_ai_content`).
- The promotion is recorded only after the governed record exists, as a `promoted` judgment naming it.

---

## 20. Suggested interpretations on the Edge (IX-17)

### 20.1 Read model

`public.suggested_interpretations(engagement)` returns kept inferences that meet all of these conditions:

- kind is `tension`, `evidence_bearing` or `realization_reading`;
- state is `current` and not superseded;
- the latest judgment is none, `investigating`, or `deferred` past its date.

For each it returns:

- kind;
- subject (reference codes and titles);
- assertion;
- generation and keep times;
- judgment state;
- the subject's nearest governance date, for ordering.

It returns nothing unless the caller holds `use_architecture_intelligence` (OD-11, IX-18). `edge_items` is not changed.

### 20.2 Placement and order

- **Placement:** a separate section, **Suggested interpretations**, on the Engagement Edge page, below all tiers. It has a one-line description: "Interpretations kept by architects on this engagement. Suggested, not established by DSA's rules."
- **Order:** the subject's nearest governance date (ascending, none last), then keep time (newest first). There is no importance order.
- **Excluded from:**
  - tiers and tier counts;
  - the overview's Development Edge section;
  - the "since you last reviewed" briefing;
  - contextual Edge panels on element and initiative pages;
  - whole-event judgment.

  On element and initiative pages, the kept interpretation appears in the drawer, not in the panel.

- **Absent** for non-holders, including the heading.
- **Empty state:** "No interpretations have been kept." This is shown to holders only.

### 20.3 ADR-0051 amendment

The Edge has a deterministic envelope (computed) and, beside it, a projected section of **stored** model inferences, `producer = model`, `epistemic_status = suggested`. The section is never mixed into the envelope, never tiered, and never judged through `edge_judgments`.

---

## 21. Stale inference UX

| Where                     | Stale kept inference                                                                                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drawer                    | Shown dimmed under "Stale: CAP-004 changed since this was generated (v3 → v4)". The stale reasons are listed in plain words. **Interpret again** is offered if availability holds. It cannot be judged (§18.3) |
| Suggested interpretations | Removed                                                                                                                                                                                                        |
| Register (§26)            | Listed with state "Stale", filterable                                                                                                                                                                          |
| Review                    | A stale kept brief is labelled "Stale: the Review's examined elements or capture changed" above the dossier, which is always current                                                                           |

Stale reason phrases map one-to-one onto `architecture_inference_state` reasons:

| Reason                       | Phrase                                           |
| ---------------------------- | ------------------------------------------------ |
| `basis_removed`              | "A record it read was retired or removed"        |
| `edge_item_changed`          | "The Edge item changed"                          |
| `newer_version_published`    | "A newer version of X was published"             |
| `basis_changed`              | "X changed"                                      |
| `class_no_longer_authorised` | "A kind of data it used is no longer authorised" |

---

## 22. Capability visibility

| Viewer                                                              | Layer 1                                         | Layer 2               | Layer 3 (item)          | Layer 3 (inference)  | Suggested section | Register    |
| ------------------------------------------------------------------- | ----------------------------------------------- | --------------------- | ----------------------- | -------------------- | ----------------- | ----------- |
| Holder of use + `edit_architecture` (default: Principal, Architect) | Yes                                             | Yes (states per §5.2) | Yes                     | Yes                  | Yes               | Yes         |
| Holder of use without `edit_architecture` (override)                | Yes                                             | Yes                   | No (as today)           | No (reads judgments) | Yes               | Yes         |
| Internal reader without use (Researcher, Project Admin, Finance)    | Yes                                             | **Nothing**           | Per existing capability | **Nothing**          | **Nothing**       | **Nothing** |
| System Administrator (not a member)                                 | As today (no access to engagement architecture) | Nothing               | —                       | —                    | —                 | —           |
| Client                                                              | No (internal surfaces)                          | Nothing               | —                       | —                    | —                 | —           |

The large-request warning shows no currency to anyone, and budget figures appear only on the Architecture Intelligence page to authorizers (as 7B.1).

---

## 23. Failure UX (IX-26)

Layer 2 shows governance states in place of an interpretation. Layer 1 is unaffected in every row.

| Condition                                         | Holder sees                                                                                                                  | Action offered                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Mode off                                          | Nothing: layer 2 is absent when the deployment has AI off                                                                    | —                             |
| `synthetic_only` on a real engagement             | "Architecture Intelligence is not available for this engagement."                                                            | —                             |
| Not authorised / class not authorised             | "External processing is not authorised for this engagement." / "…is not authorised for Evidence metadata, which this needs." | Authorizers: link to the page |
| Kind not evaluated                                | "Not yet available: no model has been evaluated for this kind of interpretation."                                            | —                             |
| Budget would be exceeded                          | "This engagement's monthly processing budget would be exceeded." (Authorizers also see the figures on the AI page)           | —                             |
| Provider unavailable / timeout                    | "The external processing provider did not respond. Nothing was recorded."                                                    | Try again                     |
| Invalid output / refusal / unknown citation       | "The interpretation did not meet DSA's requirements and was discarded."                                                      | Try again                     |
| Model not evaluated (resolved model changed)      | "The provider returned a model that has not been evaluated. Nothing was shown or recorded."                                  | —                             |
| Authorisation or capability withdrawn mid-request | "Processing stopped: the engagement's authorisation changed. Nothing was recorded."                                          | —                             |
| Subject not found                                 | "This record is no longer available."                                                                                        | —                             |
| Nothing to add                                    | "DSA's records do not support an interpretation of this." + "Reason given"                                                   | —                             |
| Keep refused (basis changed / token expired)      | "This interpretation's basis has changed; interpret again." / "This interpretation can no longer be kept; interpret again."  | Interpret again               |

These are not error banners: the same calm block as an interpretation, with the state as its text.

## 24. Cost warning (IX-25)

The Gateway's existing pre-send estimate (turns × caps × configured price) is compared with the per-request ceiling. Above 50% (PD-17), the action asks for confirmation: "This is a larger request than usual. Continue?" No figures are shown. Reuse (§16) and deterministic layers are the main cost controls.

## 25. Mobile sheet behaviour (IX-26)

- **Breakpoint.** Below the `md` breakpoint, the drawer becomes a full-height sheet with the same three layers in the same order. It has a sticky subject line and a close control.
- **Layer 1 sections** collapse to their headings after the first two, and expand on tap.
- **Examine tension** stacks the two statements. A "Show side by side" option is not offered on mobile.
- **Judgment forms** are full-width; the reason is a multiline field; the deferred date uses the native picker.
- **Promotion** opens the governed form on its own page, as today.
- **URL state** is preserved, so a sheet can be shared and reopened.
- **No new mobile-only features** are added.

## 26. Kept-interpretations register

A section on the Architecture Intelligence page, for capability holders only. It lists the engagement's kept inferences with:

- kind;
- subject;
- assertion;
- state (current, stale or superseded);
- latest judgment;
- generation and keep times.

It can be filtered by kind and state. It shows no requester names in the list (principle 20); the requester is visible in an inference's "How this was produced" disclosure, as provenance. It has no counts per person and no charts.

---

## 27. Schema and migrations

All additive; numbered after 7B.1 (`20261008…`). No change to `edge_items`, `edge_judgments`, the rule catalog, the Tool Contract functions, client policies or snapshots.

| #   | Migration                                             | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `20261008000000_ai_request_outcomes_v2.sql`           | Adds `nothing_to_add` to the request outcome check. Adds `interpret_again boolean not null default false` to `architecture_intelligence_requests` and to the request-key allowlist in `record_architecture_intelligence_request`                                                                                                                                                                                                                                                                |
| 2   | `20261008000100_inference_kept_at.sql`                | Adds `architecture_inferences.kept_at timestamptz` (null for harness-persisted rows) and `output_schema_version` acceptance of `2`                                                                                                                                                                                                                                                                                                                                                              |
| 3   | `20261008000200_keep_architecture_inference.sql`      | `public.keep_architecture_inference(engagement, request_id, inference jsonb)`:<br>• the request must exist, belong to the caller, have outcome `returned`, and be at most 30 minutes old;<br>• no inference may already exist for it;<br>• then the same verification as the 7B.1 recording operation, with the shared authorisation lock, the same authorisation id, re-emitted basis and handle check;<br>• inserts the inference and basis with `kept_at = now()`;<br>• `authenticated` only |
| 4   | `20261008000300_architecture_inference_judgments.sql` | Table (§18.1), guard, RLS (holders of use only), `record_architecture_inference_judgment`, the promotion-target check, and a helper `private.inference_latest_judgment(inference)`                                                                                                                                                                                                                                                                                                              |
| 5   | `20261008000400_ai_read_models.sql`                   | Read models:<br>• `public.architecture_intelligence_availability(engagement, subject…)`: rules §9, plus the reuse and suppression state, returning per action available / reason / reusable inference id / suppressed-by judgment;<br>• `public.current_architecture_inference(engagement, kind, subject…)`, the reuse lookup (§16);<br>• `public.suggested_interpretations(engagement)` (§20);<br>• `public.kept_architecture_inferences(engagement, filters)`, the register                   |
| 6   | `20261008000500_deterministic_dossiers.sql`           | `public.review_dossier(engagement, review)` (§8) and `public.element_supports_and_exposures(engagement, element)` (§7). Both `security definer`, `can_read_architecture`, internal only, read-only                                                                                                                                                                                                                                                                                              |

**Gate inputs the database cannot see.** The mode, the evaluated-model manifest and the provider configuration live in the application. The availability read model therefore returns the deterministic and capability parts, and the server combines them with the gate (§5.2). The database still refuses every write a holder could not make.

**No-mutation invariant (7B.1).** The read models in migrations 5 and 6 join the 47_ai_no_mutation proofs: no DML, they execute in a `READ ONLY` transaction, and the fingerprint is unchanged. The keep and judgment operations join the "writes only its own tables" proof:

- keep writes `architecture_inferences` and `architecture_inference_basis`;
- judgment writes `architecture_inference_judgments`.

---

## 28. ADRs

**New**

| ADR  | Title                                                                                              |
| ---- | -------------------------------------------------------------------------------------------------- |
| 0067 | The intelligence drawer: three layers, fixed order, deterministic first                            |
| 0068 | Availability rules: AI actions require a deterministic reason (principle 23)                       |
| 0069 | Persistence intent and keeping: ephemeral by default, keep token, keep operation                   |
| 0070 | Inference judgments, suppression and reuse                                                         |
| 0071 | Silence: the `nothing_to_add` outcome and output schema v2                                         |
| 0072 | Deterministic dossiers: the Review dossier and supports and exposures                              |
| 0073 | Activation gate: implementation acceptance vs per-kind activation; fake provider in non-production |

**Amendments**

- ADR-0051: the Suggested interpretations section beside the envelope.
- ADR-0056: producer-neutral `disagree`, and the sibling table for inferences.
- ADR-0062: the app path is ephemeral only; the large-request warning.
- ADR-0064: persistence intent, `kept_at`, reuse.
- ADR-0065: v2 prompts; the test-only manifest overlay.
- ADR-0066: the `nothing_to_add` outcome, the `interpret_again` flag, and that reuse writes no audit row.

---

## 29. RLS and security

- **New table** `architecture_inference_judgments`:
  - select only for current holders of use on the engagement;
  - no client policy;
  - writes only through its operation;
  - guard refuses update and delete.
- **Read models:** `security definer`, `search_path = ''`, executable by `authenticated` only. A client gets an empty set or `P0002`.
  - Inference-returning read models check `can_use_architecture_intelligence`.
  - Dossier read models check `can_read_architecture` and return no inference data.
- **Keep token:**
  - the HMAC is verified server-side before the database call;
  - the database re-verifies everything else, so a leaked token cannot alter content or basis;
  - the token is bound to the requester and expires after 30 minutes.
- **No service role**, as in 7B.1.
- **No inference text** in `activity_log`, logs, URLs or analytics. The drawer URL carries subject and action only.

---

## 30. Testing

### 30.1 pgTAP (new suites, indicative)

| Suite                             | Covers                                                                                                                                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `48_ai_keep`                      | Keep only by the requester, within 30 minutes, once per request, with the same authorisation, re-emitted digests and handles; refused after basis change, revocation or capability loss; refused for `nothing_to_add` and refusals |
| `49_ai_inference_judgments`       | Kinds, required fields, promotion targets, append-only, stale refusal, capability (use + edit), OD-11 reads, client denial                                                                                                         |
| `50_ai_availability`              | Every §9 rule true and false, with seed cases; suppression after `not_material`/`disagree`; suppression lifts on staleness; reuse lookup matches all five conditions and fails on each                                             |
| `51_ai_suggested_interpretations` | Inclusion/exclusion by kind, state and judgment; order; empty for non-holders and clients; `edge_items` output unchanged before and after keeping inferences (fingerprint)                                                         |
| `52_review_dossier`               | Each section for held and scheduled Reviews, comparison points, ordering, client denial, no inference data                                                                                                                         |
| `53_supports_and_exposures`       | Stances, underpinning assumptions with and without support, related risks, client denial                                                                                                                                           |
| `47_ai_no_mutation` (extended)    | New read models read-only; keep and judgment operations write only their tables                                                                                                                                                    |

### 30.2 Vitest

- Gateway: ephemeral-only app path (a source scan proves no app module uses `persist`); `nothing_to_add` handling and validation; `interpret_again` flag; large-request estimate.
- Keep token: sign and verify; tamper, expiry, wrong user, wrong engagement and wrong request are all refused.
- Schemas v2: the union; forbidden vocabulary in a reason.
- Gate composition (§5.2): every combination of mode, capability, authorisation, evaluation and availability.
- Fake provider overlay: cannot load when `NODE_ENV=production`; refused unless `synthetic_only`.
- Drawer rendering: layer order; layer 2 absent for non-holders; state copy for each governance state.

### 30.3 Proving deterministic surfaces with AI disabled (principle 22)

- A Vitest render suite renders every layer 1 assembly with:
  - mode `off`;
  - a viewer without the capability;
  - a provider error injected.
- Each must pass these assertions:
  - identical layer 1 content;
  - no AI wording;
  - no layer 2 for non-holders;
  - no thrown errors.
- A pgTAP check shows that the dossier and supports read models return the same rows whatever the engagement's authorisation and the caller's AI capability.

---

## 31. Browser acceptance plan

Production build (`pnpm build && pnpm start`) against the reset seed, in four passes.

| Pass | Configuration                                                                     | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `ARCHITECTURE_INTELLIGENCE_MODE=off`                                              | Every deterministic surface, every internal role: Review dossier, Why am I seeing this, revision, trace, supports and exposures, realization facts. No AI wording anywhere                                                                                                                                                                                                                                                                                        |
| 2    | `synthetic_only`, provider `openai` configured with no credential, empty manifest | Holders see "Not yet available" governance states; non-holders see nothing; deterministic layers unchanged                                                                                                                                                                                                                                                                                                                                                        |
| 3    | `synthetic_only`, provider `fake` (non-production server), test overlay           | Full interpretation flow per kind:<br>• availability reasons;<br>• Interpret;<br>• nothing-to-add;<br>• invalid output;<br>• Keep;<br>• keep after basis change refused;<br>• reuse;<br>• Interpret again;<br>• judgments and suppression;<br>• Suggested interpretations;<br>• stale after publishing a new version;<br>• promotion from an inference with and without brought text;<br>• large-request warning;<br>• revocation and capability removal mid-flow |
| 4    | Pass 3 configuration                                                              | Mobile viewport (390×844): sheet behaviour, layer order, judgment forms, Review dossier                                                                                                                                                                                                                                                                                                                                                                           |

**Every pass:**

- run as each internal role (Principal Architect, Architect, Researcher, Project Administrator, Finance Administrator, System Administrator);
- run as each client user (portal unchanged, route denied);
- run a leak crawl showing no interpretation text, existence or count for non-holders, and no AI content in the overview or briefing.

Screenshots and the role matrix go into the 7B.2 report.

---

## 32. Acceptance criteria

1. Every deterministic surface in §7 and §8 renders fully and identically with AI off, unauthorised, unevaluated, over budget, provider failing, and for non-holders (principle 22).
2. No AI action appears without its §9 rule holding, and each shows its reason (principle 23); lists show no per-row AI affordance.
3. The drawer shows three layers in fixed order on desktop and as a sheet on mobile (IX-26).
4. Non-holders see no interpretation text and no indication that any exist, on any page, read model or response (IX-18, OD-11).
5. No application path persists an interpretation without Keep or a judgment (IX-12); the audit is metadata-only.
6. Keep persists exactly the model's output (token-verified) and is refused after basis change, revocation, capability loss or expiry.
7. Reuse returns a kept inference only when all five §16 conditions hold, shows its generation time, and writes no audit row (IX-13).
8. `not_material` and `disagree` suppress re-offering until staleness; Interpret again is audited (`interpret_again = true`) (IX-14).
9. `nothing_to_add` is an outcome, never an inference or Edge item, and is shown in governance language (IX-15).
10. No model call happens without a person's action (IX-16).
11. Suggested interpretations contains only current, kept, unjudged (or investigating, or expired-deferred) `tension`, `evidence_bearing` and `realization_reading`. It is outside the tiers and absent from the overview, briefing, contextual panels and whole-event judgment. `edge_items` output is unchanged (IX-17).
12. Inference judgments live in their own append-only table with ADR-0056 semantics (IX-19).
13. No model text suggests a promotion target; promotion only through governed operations; brought text enters as `ai_analysis` pending (IX-20).
14. Clients: no change to any client surface, policy or snapshot (IX-21).
15. No Method/IP, Development Context, file content, web search, embeddings, MCP or background processing (IX-22, IX-23, B-16 to B-20, B-25).
16. The 7B.1 no-mutation proofs pass, extended to the new read models and operations.
17. The fake provider and test overlay cannot operate in a production build.
18. Full pgTAP, Vitest, `pnpm check`, build, DB types with no drift; browser passes 1 to 4.
19. No real provider is called and no evaluated model is added as part of 7B.2 implementation acceptance (Step B is separate).

---

## 33. Out of scope (explicit)

Generic chat; Challenge mode or kind; whole-development Read; Development Brief interpretation; arbitrary multi-object interrogation; command surface; proactive or background inference; client AI; Method-aware AI; Development Context in requests; web search; file or image processing; embeddings or vector stores; Development Environment Intelligence; MCP; autonomous promotion; AI promotion suggestions; AI ranking or scoring; AI dashboards; notifications; interpretations in the overview or briefing; new inference kinds; new Tool Contract functions; changes to OD-7 bounds; real engagement processing before B-4 prerequisites; adding credentials or evaluated models as part of implementation.

---

## 34. Difficult-to-reverse decisions

| Decision                                                                                               | Why                                                                                       |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Persistence intent = Keep or judge (PD-3)                                                              | Determines what history exists; ephemeral outputs cannot be recovered later               |
| Keep token with a new server secret (PD-4)                                                             | A new secret to operate; changing the mechanism later changes how kept content is trusted |
| `architecture_inference_judgments` as a sibling table                                                  | Append-only data accumulates there (IX-19, decided)                                       |
| `nothing_to_add` outcome and schema v2                                                                 | Audit vocabulary and output contract (IX-15, decided); v1 prompts retire                  |
| Suggested interpretations beside the Edge (ADR-0051)                                                   | Users learn where interpretations live (IX-17, decided)                                   |
| Reuse match definition (PD-13)                                                                         | Defines when two people see the same interpretation                                       |
| Judgment capability = use + `edit_architecture` (PD-6)                                                 | Who can suppress interpretations for the engagement                                       |
| Interface verbs (Explain significance, Examine tension, Examine bearing, Compare with intent, Prepare) | Users learn them (IX-2, IX-3, IX-11, decided)                                             |

---

## 35. Open decisions for Kerrick (PD-1 to PD-22)

| #     | Question                                                                                                                                                                                                   | Recommendation                                                     | Alternatives                                                                        | Reversibility  |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | -------------- |
| PD-1  | Two approvals: implementation acceptance (Step A) and per-kind activation (Step B)?                                                                                                                        | Yes (§5.1)                                                         | One acceptance after real evaluation                                                | Easy           |
| PD-2  | Fake provider and test manifest overlay for acceptance, non-production only?                                                                                                                               | Yes, under three conditions, with a production-refusal test (§5.3) | Accept 7B.2 only after real evaluation; fake only in automated tests                | Easy           |
| PD-3  | Persistence-intent signals: Keep, and judging an ephemeral interpretation?                                                                                                                                 | Both (§15.1)                                                       | Keep only                                                                           | Hard (history) |
| PD-4  | Keep token: HMAC with a new server secret and 30-minute expiry?                                                                                                                                            | Yes (§14.3)                                                        | Re-run on keep (different output); short-lived server table (durable before intent) | Moderate       |
| PD-5  | Who may keep?                                                                                                                                                                                              | The requester only                                                 | Any holder viewing it (would need shared ephemeral state)                           | Easy           |
| PD-6  | Capability to judge an inference?                                                                                                                                                                          | `use_architecture_intelligence` + `edit_architecture`              | Use only                                                                            | Moderate       |
| PD-7  | Kept `review_brief`: visible to all holders, newest supersedes?                                                                                                                                            | Yes (§13.1)                                                        | Per-person briefs                                                                   | Easy           |
| PD-8  | Show the model's "reason given" for nothing-to-add?                                                                                                                                                        | Yes, ≤300 characters, labelled, not stored                         | Fixed text only                                                                     | Easy           |
| PD-9  | Deterministic "Supports and exposures" on elements in 7B.2?                                                                                                                                                | Yes (no AI; Challenge's grounded value)                            | Defer                                                                               | Easy           |
| PD-10 | Approve the availability rules in §9 as the initial set?                                                                                                                                                   | Yes                                                                | Broader (any supported subject) or narrower                                         | Easy           |
| PD-11 | Tension pair rule (Edge co-basis, or one side revised after the other)?                                                                                                                                    | Yes                                                                | Any directly related pair                                                           | Easy           |
| PD-12 | Evidence bearing only when a summary is recorded?                                                                                                                                                          | Yes                                                                | Any current link                                                                    | Easy           |
| PD-13 | (a) Reuse match per §16 (configured requested model + evaluated resolved model). (b) Add `get_evidence` and `get_implementation_state` to `review_brief`'s plan so the brief can cite all dossier sections | (a) Yes. (b) Yes, evaluated with v2                                | (a) Exact resolved-model match only. (b) Keep the 7B.1 plan                         | Moderate       |
| PD-14 | Suppression scope: engagement-wide (all holders)?                                                                                                                                                          | Yes, like Edge judgments                                           | Per person                                                                          | Moderate       |
| PD-15 | In Suggested interpretations, `investigating` stays and expired `deferred` returns?                                                                                                                        | Yes, as on the Edge                                                | Any judgment removes                                                                | Easy           |
| PD-16 | Kept-interpretations register on the Architecture Intelligence page?                                                                                                                                       | Yes (§26)                                                          | None (drawer and Edge only)                                                         | Easy           |
| PD-17 | Large-request threshold?                                                                                                                                                                                   | Estimate > 50% of the per-request ceiling                          | A fixed token count; none                                                           | Easy           |
| PD-18 | Inference judgments outside `activity_log`, like other AI tables (OD-10)?                                                                                                                                  | Yes                                                                | Log judgments                                                                       | Moderate       |
| PD-19 | Retire all v1 prompts in favour of v2 (nothing-to-add) before any activation?                                                                                                                              | Yes; v1 was never evaluated on a real model                        | Keep v1 for kinds without silence                                                   | Easy           |
| PD-20 | Record `interpret_again` as a request flag?                                                                                                                                                                | Yes                                                                | Separate outcome                                                                    | Moderate       |
| PD-21 | Ephemeral explanations are not judgeable unless kept (judging keeps)?                                                                                                                                      | Yes (consistent with PD-3)                                         | Never judgeable                                                                     | Easy           |
| PD-22 | Development Brief (deterministic) stays out of 7B.2, as separate later work?                                                                                                                               | Yes; 7B.2 stays focused on the drawer and Prepare                  | Include the deterministic brief now                                                 | Easy           |

---

## 36. Next step

1. Kerrick reviews this proposal and the PD answers.
2. On his instruction: Revision 2 of this proposal if needed, then implementation (Step A) under his explicit approval to lift the 7B.2 hold.
3. Separately, on his instruction and with a credential he provides: the governed seed-only real-model evaluation of the v2 prompts per kind (Step B), and the reviewed manifest changes.

Until then: no implementation, no credential, no provider call, no evaluated-model change, and the Phase 7B.2 hold stays.
