# ADR-0060: External AI processing authorisation, processing mode, data origin and data classes

**Status:** Accepted (Phase 7B.1; approved 2026-10-01)

## Context

Phase 7B.1 proposal §5, §6 and §8; reconciliation decisions B-1, B-2 and B-4; Kerrick's OD-1, OD-3, OD-4, OD-6 and OD-10.

Architecture Intelligence may send governed engagement records to an external model provider. That is a disclosure of client-confidential material outside DSA, so it needs an explicit, attributable decision per engagement, a way to keep real engagements out of evaluation, and a closed statement of what kinds of data can ever leave. The governing principle (B-1, Kerrick 2026-09-30): **authorised to leave DSA is not the same as automatically included in model context.**

## Decision

**Authorisation is a versioned engagement record.** `public.engagement_ai_authorizations` is append-only: each row is a version (`sequence_no`, assigned under an engagement-scoped advisory lock), either `authorized` (data classes, provider, processing region, basis kind and reference, monthly budget, effective date) or `not_authorized` (a revocation, which must say why). The current row is the authorisation in force. No row means not authorised: the default is No. Rows are written only by `public.set_engagement_ai_authorization`, by holders of `authorize_external_ai_processing` (ADR-0061), only for `proposed` or `active` engagements (OD-3), never future-dated. Attribution (`authorized_by`, `authorized_at`) comes from the session, never the caller. Update and delete are refused for every role, including the database owner (guard trigger). The table is readable by internal readers of the engagement's architecture, never by clients. It is not written to `activity_log` (OD-10): it is itself the attributed record.

**Basis.** `client_agreement`, `data_processing_addendum`, `written_client_instruction` or `synthetic_evaluation`. `synthetic_evaluation` is accepted exactly when the engagement's data is synthetic, and only then.

**Data origin (OD-4).** `engagements.data_origin` is `real` (default) or `synthetic` and describes the provenance of the engagement's data. It is immutable: no operation sets it, an engagement created in DSA cannot claim `synthetic`, and any change is refused. Only migrations and the seed set `synthetic`; all three seed engagements are synthetic.

**Processing mode.** `ARCHITECTURE_INTELLIGENCE_MODE` (server environment): `off` (default, and the value whenever it is absent or invalid), `synthetic_only` (only synthetic engagements may be processed) or `enabled`. It is read before every send, so it is also the kill switch. 7B.1 is accepted in `off` and `synthetic_only`.

**Data classes (closed).** `published_architecture`, `working_architecture`, `project_intelligence`, `evidence_metadata`. Nothing else has a class and so nothing else can be authorised: Method/IP, `approach` statements, records with `ip_classification` `tplco_method_ip` or `licensed_third_party_source` (OD-6, enforced in the database projection, not the UI), files and file contents, finance, activity logs, client-authored text, person names and Development Contexts. Classification is per field, inside the Tool Contract's projections (ADR-0063).

**Eligibility is not inclusion.** An authorised class is eligible to leave DSA; a request sends only what its kind's context plan needs (AUTHORISED ⊇ PERMITTED ⊇ INCLUDED, ADR-0063).

## Consequences

- Revocation stops future processing and stops an invocation in progress at its next send (ADR-0062). It cannot recall data already sent, and the UI says so.
- A change of provider, region or classes is a new version; inferences whose basis used a removed class become stale.
- `data_origin` is a permanent column on a core table.
