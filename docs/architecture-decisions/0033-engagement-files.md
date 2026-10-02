# ADR-0033: Engagement files in private storage

**Status:** Accepted (Phase 4 proposal decision D12; approved 2026-09-30)

## Context

Information requests and evidence need files, not only links. Files are confidential client material.

## Decision

- A private Supabase Storage bucket, `engagement-files`, holds files at `{engagement_id}/{file_id}/{file name}`, up to 25 MB, from an allowed list of document and image types.
- Every object has a row in `engagement_files`, registered by `register_engagement_file` before upload. The row names the purpose (`client_response`, `client_contribution` or `evidence`) and, once attached, the response, contribution or evidence source it belongs to.
- Storage policies: a caller uploads only to a path registered by themselves; a file is readable by internal readers of the engagement, by its uploader, and by client members who can see the response or contribution it is attached to. There is no update or delete policy.
- Evidence files are internal; clients see evidence only as citations in published snapshots.
- Downloads use short-lived signed URLs created with the caller's own session.

## Consequences

Files cannot be replaced or removed through the application; a wrong file is superseded by a new one.

**Amended (V1-A Increment 3):** a client also reads the files of a deliverable they can read, on every published version. See [ADR-0075](0075-client-records-and-deliverable-files.md).
