# ADR-0031: Phase 4 capabilities

**Status:** Accepted (Phase 4 proposal §12.1, decisions D6 and D7; approved 2026-09-30)

## Decision

| Capability                  | Side     | Default holders                                                   |
| --------------------------- | -------- | ----------------------------------------------------------------- |
| `manage_client_requests`    | internal | Principal Architect, Architect, Researcher, Project Administrator |
| `view_full_architecture`    | client   | Executive Sponsor, Client Project Lead, Client Viewer             |
| `respond_to_client_actions` | client   | Executive Sponsor, Client Project Lead, Client Contributor        |
| `assign_client_actions`     | client   | Executive Sponsor, Client Project Lead                            |
| `submit_client_input`       | client   | Executive Sponsor, Client Project Lead, Client Contributor        |

Triage, resolution, Principal-level escalation, contribution handling and signal dismissal use `edit_architecture`. Client-executive escalation and risk acceptance use `publish_architecture`. Overrides of the new capabilities are managed like other non-financial capabilities (ADR-0008); architecture authority stays with Principal Architects (ADR-0024 amendment).

## Consequences

Enum values are permanent. Client Finance holds none of the new capabilities.
