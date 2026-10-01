# ADR-0061: Architecture Intelligence capabilities

**Status:** Accepted (Phase 7B.1; approved 2026-10-01)

## Context

Phase 7B.1 proposal §5.3 and §7; reconciliation decision B-10; Kerrick's OD-1 and OD-2. Permissions in DSA are capabilities, never role names (ADR-0008, ADR-0024).

## Decision

Two permanent, internal-only engagement capabilities:

| Capability                         | Meaning                                                                                                  | Default holders                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `use_architecture_intelligence`    | May request Architecture Intelligence on the engagement, and read its inferences and their basis (OD-11) | Principal Architect and Architect |
| `authorize_external_ai_processing` | May record or revoke the engagement's external-processing authorisation, and read the request audit      | Principal Architect               |

- Researchers do not hold `use_architecture_intelligence` by default (OD-2). Project Administrators, Finance and System Administrators hold neither.
- Both are architecture-authority capabilities (`public.is_architecture_authority_capability`): overrides are granted or revoked only by a Principal Architect on the engagement, never for themselves (ADR-0024 amendment).
- Both are `internal` in `public.capability_side`, so an override row cannot be created for a client member, and a forced one confers nothing.
- Use is separate from editing in both directions: `edit_architecture` without use cannot invoke anything; use without `edit_architecture` cannot edit.
- `private.can_use_architecture_intelligence(eng)` and `private.can_authorize_external_ai_processing(eng)` require internal architecture read access and an active membership holding the capability.

## Consequences

The capability catalog (`src/domain/capabilities/catalog.ts`) mirrors the defaults, and its test parses the migrations. The override screen shows both capabilities, offering them only to Principal Architects and never on their own row.
