# ADR-0059: Practice Intelligence in Phase 7A

**Status:** Accepted (Phase 7A; approved 2026-09-30)

## Context

Phase 7A proposal (Revision 2) §17 and §29.2 clarification 3; reconciliation decisions Q10, Q11 and Q23 and candidates D-26, D-27, D-41, D-42, D-43 and D-44; Kerrick's OD-5.

Phase 6 built the Method Library and Method Applications as off-spine practice records (ADR-0041 to ADR-0044). Practice Intelligence asks what the practice's own records say about how Methods are applied. It has to stay inside two boundaries: Method/IP content is internal only (ADR-0022, ADR-0043), and there is no cross-engagement architectural learning in Phase 7 (Q10). Small samples also invite misleading proportions: "2 of 3 applications skipped this stage" reads as a finding when it is three events.

## Decision

**Per-application conditions inside the engagement.** Three Edge rules, internal and engagement-scoped like every other rule (ADR-0051), with `home = 'practice'`:

- `method_basis_superseded` (D-26, D-27), two variants:
  - `pinned_version_superseded`: an open (`planned` or `in_progress`) Method Application pinned to a Method version whose lifecycle is `superseded`. Ambient, because pins are deliberate (ADR-0043).
  - `release_moved`: open applications started under a DAM release that is no longer the engagement's release, or is no longer the published release. **One engagement-level item** (subject type `engagement`) listing the affected open applications in its details and basis. Attention.
- `application_outputs_absent` (D-41): a completed application with a declared output (`method_version_outputs`) that has no corresponding `produced` link.
- `application_instrument_evidence_absent` (D-42, narrowed): a completed or discontinued application whose Method declares an Instrument that no `gathered` evidence cites.

None requires a change to a Method. Their resolving acts are recording the output or evidence through ordinary operations, recording an addendum, or changing the engagement's release, or a judgment (ADR-0056).

**Counts on the Method Asset page** (the deferred D-43, as counts rather than an Edge item). `public.method_practice_counts(p_asset_id)` is `security definer` and returns rows only to internal users (`private.is_internal()`, the Method Library's readers). Three measures:

| Measure                     | What is counted                                                                                                                       | n                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `stage_treatment`           | Per stage of each version, how many closed applications recorded each treatment (`followed`, `adapted`, `skipped`)                    | Closed applications of the version |
| `co_use`                    | Per pair of versions, how many closed applications of this version were in an engagement that also applied the other Method's version | Closed applications of the version |
| `standard_informs_criteria` | Per Standard version, how many agreed (or since superseded or withdrawn) acceptance criteria it informed                              | The count itself; no proportion    |

"Closed" means `completed` or `discontinued`.

- **n is always returned and shown.**
- **A proportion is returned only when n is at least 5** closed applications of the version (`private.practice_min_n()`, OD-5), rounded to two places. Below that the page says there are fewer than 5 closed applications, gives n, and shows no proportion. The threshold is enforced in SQL, not only in the UI.
- **The threshold is a product and governance threshold** for avoiding meaningless small-sample proportions. It is not a statistical-validity claim, and the page never describes any n as significant.
- **No engagement names, client names or free text** are returned. Stage notes and addenda are never read into the counts. Method titles and version labels are Method Library content, internal already.

## Consequences

- Architects can see how the practice's Methods have actually been applied, within the engagement as conditions and across the practice as bare counts with their n.
- Not in Phase 7A: summaries of stage-note or addendum free text, outcome attribution to Methods, any Method score or rank, recommendations to change a Method, automatic Method changes, automated method recommendations, cross-engagement architecture comparison or recurrence, Pattern extraction or the Pattern Library (Q23), and analysis of disagreement judgments (D-44). Method revision stays the Phase 6 authoring flow with learning sources.
- No AI is used, nothing is scored, and no count reaches a client.
