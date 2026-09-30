# ADR-0009: Future architecture objects must record their provenance

**Status:** Accepted as a requirement for Phase 3. Nothing is built yet.

## Context

DSA OS will hold knowledge, capability, strategic-model and application objects (spec Phase 3 onward) that combine what the client told us, what is publicly known, what architects observed and concluded, what the client decided, and what software produced. Clients and architects must always be able to tell which is which: a client decision carries different weight from an architect's judgment, and AI analysis must never be mistaken for either. Retro-fitting provenance after objects exist would mean guessing at history.

## Decision

Every architecture object introduced from Phase 3 onward, and every material statement within one, must carry a **provenance type** from this closed list:

| Provenance              | Meaning                                                              |
| ----------------------- | -------------------------------------------------------------------- |
| `client_source`         | supplied by the client (documents, data, interviews)                 |
| `public_source`         | from a public source (published data, regulation, research)          |
| `architect_observation` | something an architect observed directly                             |
| `architect_judgment`    | an architect's professional conclusion or recommendation             |
| `client_decision`       | a decision the client made or approved                               |
| `ai_analysis`           | produced or drafted by AI analysis; never final without human review |
| `methodology_derived`   | produced by applying the Development Architecture Method             |
| `system_derived`        | computed by DSA OS from other records (totals, statuses, rollups)    |

Alongside the type, objects will record: who recorded it and when; the source reference (document, URL, meeting) where one exists; and, for `ai_analysis`, the reviewing person and review state. Changes of provenance are audited.

## Consequences

- Phase 3 schema design starts from this list; the enum and columns are added with the first architecture tables, not before.
- `methodology_derived` content must respect the Method/IP boundary: the derived object may be client-visible while the Method content it came from stays internal.
- Client-facing views will be able to filter and label content by provenance, and AI output can be held back from clients until reviewed.
- Adding a provenance type later requires a new ADR.

## Amendment (Phase 6, 2026-09-30)

`methodology_derived` is read narrowly: content literally taken from TPLCo's Method, such as a Model instantiated into architecture. It does not cover work merely discovered while using a method or structured by a template. Publishing an element whose provenance, or any of whose statements, is `methodology_derived` requires `instantiates` lineage to a published Model version, or one since superseded (Phase 6 decision D19). See ADR-0047. The list of provenance types is unchanged.
