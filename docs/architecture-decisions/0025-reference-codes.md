# ADR-0025: Permanent reference codes and prefixes

**Status:** Accepted (Phase 3 proposal §4.0, §6.13 and §15.13)

## Context

Clients, documents and reviews will cite elements by code, such as `CAP-004`.

## Decision

- Prefixes: `KNW`, `CAP`, `STR`, `APP` for core objects by domain; `ASM`, `RSK`, `CNS`, `DEP`, `DEC`, `REC` for Project Intelligence records.
- `architecture_reference_counters` holds one row per engagement and prefix, incremented in the creating transaction under a row lock (as Phase 2 document numbers). Codes are unique per engagement, sequential, never reused and never changed; gaps are tolerated.
- The code is assigned by trigger on insert and cannot be written by users.

## Consequences

- Codes stay stable if a type is renamed or split.
