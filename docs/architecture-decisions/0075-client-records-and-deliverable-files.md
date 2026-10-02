# ADR-0075: Client-facing records and deliverable files

**Status:** Implemented on a draft PR (V1-A Increment 3, Workstream B; plan decisions D9 and D13 accepted by Kerrick 2026-10-02). Not yet merged or accepted.

## Context

V1-A plan §4 Workstream B (B1-B3) and decision D9. Deliverables, Reviews and Implementation Initiatives are element kinds on the shared architecture spine, and the database already governed their client visibility through `architecture_elements.client_visibility`: only a holder of `publish_architecture` may change it, and every client read model and policy goes through `private.element_client_readable` (client-visible, published, not retired, inside the reader's areas, and for a confidential deliverable `view_confidential_deliverables`). Three things were missing:

- The only UI that set visibility was the generic element form, which cannot open these kinds (C1, a later workstream), so none of them could reach a client.
- `private.can_read_engagement_file` had no clause for deliverable files, so a client who could see a deliverable could not open its file.
- A deliverable file is attached to the published version it documents, and the pages showed only the latest version's files, so a republication made earlier files disappear from view.

## Decision

**No parallel visibility system (B1).** Client visibility for the three kinds remains the spine column and its existing database rules. Each record's page gains one shared control, offered to holders of `publish_architecture` and wired to one server action that updates the column as the signed-in user. Capabilities that manage the record (`manage_deliverables`, `manage_reviews`, `manage_implementation`) do not grant it. A record is visible to a client only when it is both client-visible and published, so a client sees published versions only; making a record internal hides it, and its files, at once.

**Client file reads mirror the client read of versions (B3).** One function is redefined: `can_read_engagement_file` gains a clause that admits a file when it is a `deliverable` file attached to a version, the reader holds `view_architecture` on the file's engagement, and the deliverable is `element_client_readable`. The engagement-files row policy and storage policy both call the function, so the row and the stored object open together; `/files/[fileId]` is unchanged and answers 404 to anyone else. Every earlier clause is unchanged, so no reader loses access. Unattached deliverable files, evidence files, other engagements' and other clients' files stay closed to clients.

**Files belong to their version (D9).** A file stays linked to the published version it was attached to. A republication neither copies files forward nor hides earlier ones. Internal and portal pages list a deliverable's files across all its published versions, grouped and labelled by version, with the current version marked. A client reads files on every published version of a deliverable they can read, as they read every published version.

**Portal.** A Deliverables page in the client portal lists the deliverables the client may read, with their files by version; the overview links to it. Reviews and Implementation already had portal pages driven by their client read models.

**Review fields (B2).** A review's own fields (kind, scheduled date, baseline, summary) are edited on its page by `manage_reviews` holders, under the existing column grant and update policy. The page now shows the review's own summary, the one its client snapshot carries.

## Consequences

- One migration, function-only; no table, column or policy changes and no type drift.
- Amends ADR-0033: a client also reads the files of deliverables they can read.
- Tests: pgTAP `62_client_records_and_files`; the fresh-install browser run proves G-6, G-7 and the visibility part of G-8.
- Still outside this increment: the generic element route for these kinds (C1), the seeded demo's client-visible records and files (F8), and the client Documents area (V1-C).
