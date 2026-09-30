# ADR-0029: Client actions and client contributions

**Status:** Accepted (Phase 4 proposal §8 and §15.5; approved 2026-09-30)

## Context

Spec §7–8 and §26 describe "Client Actions": what TPLCo needs from the client. Without a boundary this becomes a general task system, which the product direction excludes.

## Decision

- A client action is one request from TPLCo to one named client engagement member, of a closed set of kinds: `question`, `information_request`, `confirmation`, `review_request`, `executive_attention`. It carries a permanent `ACT-nnn` code.
- Its subjects are published, client-visible elements within the addressee's areas at the time it is sent. Clients see subjects only as published snapshots.
- Status: `open`, `responded`, `closed`, `withdrawn`; returning a response sets it back to `open`. Overdue is derived from the due date and the business date, never stored. Every transition is an operation and an event in `client_action_events`.
- Responses are append-only. TPLCo may record a response as an evidence source with `client_source` provenance; nothing becomes evidence automatically.
- Client contributions are a client member's input on a published element in their areas. TPLCo marks each one incorporated (optionally as evidence) or acknowledged. Contributions never edit the architecture.
- Approvals and decisions remain Phase 3 records; the client Actions tab lists them together with client actions.

## Consequences

- There are no internal tasks, boards or assignments of architecture work.
- Action codes are cited by clients and are never reused.
