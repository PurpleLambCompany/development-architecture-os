# ADR-0050: Method Library / Pattern Library boundary; AI prompts excluded

**Status:** Accepted (Phase 6; approved 2026-09-30)

## Context

Phase 6 proposal (Revision 2), decisions D25 and D26.

Spec §14 lists "system-design patterns", "governance patterns" and "AI prompts" among Method Library categories, while spec §16 defines a separate Pattern Library and spec §18 and §31 place all AI in Phase 7. Kerrick's Q14 and Q17 decisions keep patterns and AI prompts out of the Method Library.

## Decision

**The boundary (D25).**

|                         | Method Library (Phase 6)                             | Pattern Library (later phase)                                                          |
| ----------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Holds                   | How TPLCo works: practice                            | What worked as architecture: reusable, abstracted architecture structures              |
| Origin                  | Authored by TPLCo                                    | Abstracted from engagement architecture after completion, with client rights respected |
| Unit                    | Method Asset versions                                | Patterns: anonymized structures of object types and relationships, with conditions     |
| Relation to engagements | Applied (Method Application) or instantiated (Model) | Instantiated into new architecture                                                     |
| Confidentiality         | TPLCo method IP                                      | Client-derived; needs abstraction and consent rules                                    |

Rules in force from Phase 6:

1. Patterns are not Method Assets. `method_asset_categories` has no pattern category.
2. A Model is not a Pattern. A Model is authored practice; a Pattern is abstracted evidence of results. A Pattern may later be promoted into a Model through ordinary authoring, with learning sources recorded.
3. No Phase 6 table, column or enum anticipates patterns.
4. No Phase 6 operation copies engagement architecture into the Method Library.

**AI prompts (D26).** There is no category, form, table or storage for AI prompts. Prompt governance is designed in Phase 7.

## Consequences

- Nothing converts and nothing is built for the Pattern Library now. It will reference elements and baselines, which already exist and are immutable.
- Phase 6 builds no AI of any kind: no prompt storage, execution or orchestration, no generation, no summarization, no method recommendation or automatic method selection, no success scoring and no pattern mining or automated pattern extraction.
