# ADR-0067: The intelligence drawer and drawer subjects

**Status:** Accepted (Phase 7B.2 Step A; decisions approved by Kerrick 2026-10-01)

## Context

Phase 7B.2 proposal §3, §6, §7, §22 and §25; reconciliation decisions IX-2, IX-3, IX-4, IX-7, IX-11, IX-18 and IX-26, and principles 16, 22 and 23; Kerrick's PD-1 and PD-10.

Phase 7B.1 built Architecture Intelligence with no user-facing surface (OD-12). Phase 7B.2 makes the five existing inference kinds usable from the governed objects they concern. Without one pattern, every page would invent its own placement, and an interpretation could be read before, or instead of, the deterministic facts it rests on. The reconciliation's principles require that deterministic surfaces are complete on their own with AI unavailable (principle 22), that the availability of an interpretation is itself explainable (principle 23), and that people without `use_architecture_intelligence` see neither interpretation text nor the existence of interpretations (IX-18).

## Decision

**One drawer, three layers, fixed order.** `src/components/architecture-intelligence/drawer.tsx` (`IntelligenceDrawer`) is the only place an interpretation is shown. It always renders, in this order, on every surface and device:

| Layer | Label (`LAYER_LABELS`)     | Content                                                                                                                          | Who sees it                                                   |
| ----- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1     | What DSA knows             | The deterministic assembly for the subject: complete, never collapsed, never "interpret to see more"                             | Every internal reader of the engagement's architecture        |
| 2     | Interpretation · suggested | The gate's state or the action with its "Offered because …" reason (ADR-0068); a kept, reused, stale or ephemeral interpretation | Holders of `use_architecture_intelligence`, with AI not `off` |
| 3     | Judgment                   | The deterministic item's judgment (ADR-0056) and, separately, the interpretation's (ADR-0070)                                    | Holders of the respective capabilities                        |

**Layer 1 is deterministic.** It is assembled from read models that never call the Gateway, write no audit row and spend no budget: the `edge_items` envelope and rule catalog ("Why am I seeing this?"), `element_revisions`, `impact_trace`, the existing evidence and initiative read models, and the two Step A dossiers, `review_dossier` and `element_supports_and_exposures` (ADR-0072). It returns the same content whatever the engagement's authorisation and the reader's AI capability.

**Layer 2 is absent, not empty, for non-holders and with AI off.** `getLayer2` (`experience/queries.ts`) returns `{ state: "absent" }` before reading anything further when the processing mode is `off` or the reader does not hold `use_architecture_intelligence`; the drawer then renders no heading, placeholder, count or hint. For holders the pure function `composeGate` (`experience/gate.ts`) decides between `unavailable` (a governance sentence from `GATE_COPY`, with a link to the Architecture Intelligence page for authorisers where relevant), `not_offered` (the rule's own explanation, `NOT_OFFERED_COPY`) and `offered` (the reason, and whether the request is large, ADR-0068). Layer 2 is typographically distinct and calm: a label, a muted rule, citations as reference codes with versions, no severity colour or alert iconography, and never styled as a governed record or Edge item.

**Layer 3 keeps its two judgments apart.** Judging the deterministic item never judges an interpretation, and the reverse. When layer 2 is absent the item's judgment still renders under its own heading.

**Drawer subjects.** Each drawer subject maps to exactly one of the five 7B.1 inference kinds and one 7B.1 Gateway subject (`experience/subjects.ts`). There is no new kind, subject type or Tool Contract function.

| `drawer`     | Opened from                                                                                                         | Question line                    | Interface verb (`ACTION_LABELS`) | Kind                  | 7B.1 subject    |
| ------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------- | --------------------- | --------------- |
| `edge`       | Engagement Edge; contextual Edge panels on element, initiative and Review pages (items whose subject is an element) | Why am I seeing this?            | Explain significance             | `explanation`         | `edge_item`     |
| `revision`   | Element page, substantive revisions                                                                                 | What changed in this revision    | Explain significance             | `explanation`         | `revision`      |
| `trace`      | Element page, impact trace                                                                                          | What changing this reaches       | Explain significance             | `explanation`         | `impact_trace`  |
| `pair`       | Element page, related elements                                                                                      | These two elements, side by side | Examine tension                  | `tension`             | `element_pair`  |
| `evidence`   | Element page, evidence lines of Supports and exposures                                                              | This evidence link               | Examine bearing                  | `evidence_bearing`    | `evidence_link` |
| `review`     | Review page                                                                                                         | Review dossier                   | Prepare                          | `review_brief`        | `element`       |
| `initiative` | Implementation Initiative page                                                                                      | Realization facts                | Compare with intent              | `realization_reading` | `element`       |

The word "Read" is not used as an interface verb (IX-11). For a `pair`, the element whose page the drawer was opened from is A.

**The URL is the drawer's state.** A drawer is addressed by query parameters carrying subject and action only: `drawer`, `el`, and as the subject requires `el2`, `rule`, `fp` (the Edge item's fingerprint), `ver`, `link` and `lt` (`statement_link` or `element_link`). `drawerFromQuery` accepts only well-formed identifiers and bounded strings; anything else opens no drawer. `pageDrawer` closes a drawer by removing only these parameters, so the page's own state survives. A drawer can be linked, reloaded and shared, one drawer is open at a time, and no inference text, request id or keep state ever appears in a URL.

**Opening never calls a model.** A drawer is server-rendered from read models. It may show a kept inference (reused or the newest kept, ADR-0068); generating requires the person to press the action. The text of an ephemeral interpretation lives only in the open drawer's client state; the server holds its only durable copy as a pending interpretation (ADR-0069).

**A kept interpretation opens in its subject's drawer.** From Suggested interpretations and the kept register (ADR-0068), `inferenceDrawerHref` opens an initiative's drawer on its page, a Review's on its page, an Edge item's on the Engagement Edge, and every other subject on its element's page.

**Clutter rule.** Lists show no AI affordance per row. The action appears inside the drawer, beside the deterministic section it extends.

**Mobile.** Below the `md` breakpoint the drawer is a full-height sheet with the same three layers in the same order, a sticky subject line and a close control; the dimming overlay is shown only on wider screens. Escape closes the drawer to its URL without the drawer parameters, and the page behind does not scroll. Examine tension stacks the two statements. Promotion opens the governed form on its own page. No mobile-only feature exists.

## Consequences

- Every surface reads the same three layers, and an interpretation is never seen without the deterministic facts above it.
- With AI off, unauthorised, unevaluated, over budget or failing, layer 1 is unchanged and remains enough to act on (principle 22).
- A Researcher, Project Administrator or Finance Administrator sees the same dossiers and facts as an architect, and nothing indicating that interpretations exist.
- Adding a drawer subject means a subject mapping, a layer-1 assembly, an availability rule (ADR-0068) and tests; it cannot add an inference kind or a Tool Contract function on its own.
- Implementation note: proposal §25 suggested collapsing layer-1 sections to their headings after the first two on mobile. The implementation keeps layer 1 fully expanded on every device, in line with §6.2 rule 1 ("Layer 1 is never collapsed by default").
