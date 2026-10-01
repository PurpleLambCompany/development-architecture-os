# ADR-0071: Version 2 outputs and prompts: nothing to add, retired version 1, the Review brief plan and Interpret again

**Status:** Accepted (Phase 7B.2 Step A; decisions approved by Kerrick 2026-10-01)

## Context

Phase 7B.2 proposal §13.2, §17 and §27; reconciliation decisions IX-13, IX-14 and IX-15; 7B.1 decisions OD-8 and OD-9; Kerrick's PD-8, PD-13b, PD-19 and PD-20.

Architecture Intelligence must be able to be silent (IX-15). In 7B.1 every valid output was an interpretation, so a model whose records did not support one had either to restate them or to produce an interpretation it could not ground. Silence needs its own output, its own audit outcome and its own words, and it must not become an inference, an Edge item or something a person can keep or judge. Separately, the Prepare interpretation could not cite every section of the deterministic Review dossier (ADR-0072), because the 7B.1 `review_brief` plan could not reach evidence or implementation state (proposal §13.2).

## Decision

**Output schema version 2.** `OUTPUT_SCHEMA_VERSION = "2"` (`kinds/schemas.ts`). Each kind's output is one strict object, because structured-output providers require an object at the root:

```
{ "result": "interpretation" | "nothing_to_add", "interpretation": <v1 envelope> | null, "reason": string | null }
```

- `interpretation`: `interpretation` holds the version 1 envelope for the kind, unchanged (assertion, cited claims, uncertainty, examination, payload), and `reason` is null.
- `nothing_to_add`: `interpretation` is null, so there are no claims, handles or payload, and `reason` is one sentence of 1 to 300 characters (`NOTHING_TO_ADD_REASON_MAX`).

A refinement enforces exactly one branch. Validation still applies to silence: a reason containing forbidden vocabulary is `invalid_output`. There is no repair and no retry of an invalid output (OD-9). The proposal described this as a discriminated union; the implementation expresses the same union as one object for provider compatibility.

**Silence is an outcome, never an inference (PD-8).** The Gateway checks the resolved model is evaluated before it accepts silence, then records the request with outcome `nothing_to_add`, its tokens and its estimated cost, like any model call (migration `20261008000000`, ADR-0066 amendment). Nothing is held for keeping, persisted, projected to the Edge or offered for judgment, and `record_architecture_intelligence_request` refuses an inference with any outcome other than `persisted` or `returned`. The drawer shows "DSA's records do not support an interpretation of this." and, beneath it, the model's reason labelled "Reason given by the model (not recorded)". The reason is returned to the requester's open drawer only; it is stored nowhere. Silence is not a reuse key: asking again calls the model again, which is acceptable because the request is deliberate.

**Version 2 prompts; version 1 retired (PD-19).** Every kind has a `v2.md` prompt and the shared generation policy has `generation-policy/v2.md`, each pinned by SHA-256 in `prompts/manifest.ts`. The version 2 policy adds a **Silence** section: the model may conclude that the records do not support a cited interpretation, should prefer saying nothing to add over an interpretation the records do not support, one that only restates them, or one resting on what is withheld or not recorded, and gives a one-sentence reason under the same vocabulary rules. Each kind's prompt says when silence is the right answer for that question. Every version 1 prompt is `retired`, and the version 1 generation policy is kept as pinned history in `RETIRED_GENERATION_POLICIES`; their files stay unchanged. Version 1 was never evaluated on a real model, so nothing evaluated is lost. Every version 2 prompt's `evaluatedModels` is empty: no real model is listed, and every real-provider output remains refused as `model_not_evaluated` until Step B (ADR-0073).

**The Review brief plan (PD-13b).** `review_brief`'s context plan (`kinds/plans.ts`) adds `get_evidence` and `get_implementation_state` to its permitted tools, so a brief can cite the dossier's evidence and implementation sections; escalation state was already reachable through `get_project_intelligence`. This is a context-plan change evaluated with the version 2 prompt, not a Tool Contract change: no function is added, `published_architecture` remains the only required class, the evidence summary stays excluded for this kind (OD-5), and evidence and implementation rows are withheld as before when their class is not authorised, in which case the brief says what it could not see. The `review_brief` v2 prompt tells the model it may request these when a point needs it, and to say nothing to add when nothing has changed and nothing remains open. OD-7's bound of six model-requested calls is unchanged.

**Interpret again is a request flag (PD-20).** `architecture_intelligence_requests.interpret_again boolean not null default false` records that a person deliberately asked again where a kept interpretation was shown for reuse or a judgment suppressed re-offering (IX-13, IX-14). It is a flag, not an outcome: the request still ends `returned`, `nothing_to_add` or a refusal. The recording operation accepts `interpret_again` in its allowlist and refuses a non-boolean. The server action refuses an invocation without the flag while the drawer is in a reuse or suppression state, so an out-of-date screen cannot bypass either.

## Consequences

- An honest "nothing to add" is a first-class, audited answer that costs what the call cost and leaves nothing behind.
- Activating any kind (Step B) evaluates its version 2 prompt, including its silence behaviour and, for `review_brief`, the widened plan.
- The request outcome set grows to fifteen values (`persisted`, `returned`, `nothing_to_add` and twelve refusals or failures); `interpret_again` lets audit readers see deliberate repeats per engagement without any per-person view (ADR-0066).
- A further output change is a version 3 schema with new prompt versions and a new evaluation, never an edit to version 2.
