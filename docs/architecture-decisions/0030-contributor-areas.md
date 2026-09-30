# ADR-0030: Client Contributors see assigned areas

**Status:** Accepted (Phase 4 proposal §9, decisions D1, D2 and D8; approved 2026-09-30)

## Context

Spec §4 and §27 limit Client Contributors to assigned project areas. In Phase 3 every client member with `view_architecture` saw the whole published, client-visible architecture.

## Decision

- A new client capability, `view_full_architecture`, means "see the whole published, client-visible architecture". Executive Sponsors, Client Project Leads and Client Viewers hold it by default; Client Contributors do not.
- `engagement_member_areas` assigns a client member a domain, or an element and its `part_of` descendants (following published, active `part_of` relationships).
- A Project Intelligence record is inside a member's areas when one of its domains is assigned, when an element it concerns (through a Project Intelligence relationship or a dependency's ends) is inside them, or when the record itself is assigned. An engagement-wide record is inside only when assigned directly.
- The rule is enforced in one helper, `private.element_client_readable`, which every client policy and client read model already uses. Internal readers are unaffected.
- Areas are assigned and removed by those who manage the engagement (Principal Architects, System Administrators and assigned Project Administrators).

## Consequences

- Existing Client Contributors see nothing until they are given areas or `view_full_architecture` by override.
- Domain states remain visible to every client member.
