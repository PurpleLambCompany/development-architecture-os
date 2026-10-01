# ADR-0073: The deterministic fake provider and test manifest overlay for Step A

**Status:** Accepted (Phase 7B.2 Step A; decisions approved by Kerrick 2026-10-01)

## Context

Phase 7B.2 proposal §5 and §31; reconciliation decision IX-1; 7B.1 decisions OD-8 and OD-14; Kerrick's PD-1 and PD-2.

IX-1 requires a governed seed-only real-model evaluation before any user-facing interpretation can be produced by a real model. The interpretation experience still has to be built, tested and accepted in a browser, showing every state honestly (an interpretation, nothing to add, invalid output, a refusal, a provider failure, keeping, reuse, a change of resolved model, judgment, suppression, staleness, promotion) without a credential or a provider call. The Gateway refuses any resolved model not listed as evaluated (OD-8), and the committed manifest lists none.

## Decision

**Two approvals (PD-1).**

| Step                                  | What it is                                                                                                                                                                           | Status                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| **A. 7B.2 implementation acceptance** | Everything in ADR-0067 to ADR-0072 built and tested; interpretation paths exercised end to end with the deterministic fake provider in non-production                                | This step                      |
| **B. Kind activation** (one per kind) | Seed-only real-model evaluation of that kind's version 2 prompt, manual grading, a committed metadata-only report (OD-14), and a reviewed manifest change adding the evaluated model | Not started; separate approval |

Step A never makes a real model's output reachable. Step B changes no code path: it adds a manifest entry the Gateway already requires. Step A ships the deterministic surfaces to every engagement; Step B, when approved, turns on interpretations for synthetic engagements, and for real ones only once B-4's contractual prerequisites are met and the mode is `enabled`. **Real-provider evaluation has not been done, no model is in the evaluated manifest, and Step B activation has not occurred.**

**The fake provider (PD-2).** `ARCHITECTURE_INTELLIGENCE_PROVIDER=fake` selects the deterministic fake provider only when all three hold (`fakeProviderConfig`, `config.ts`):

- `ARCHITECTURE_INTELLIGENCE_MODE` is `synthetic_only`, so only synthetic engagements can be processed;
- `NODE_ENV` is not `production` (every production build and `next start` set it, so a production server can never use the fake);
- the region and per-request ceiling are configured.

Otherwise `activeProvider` returns no provider at all: naming `fake` never falls back to a real provider, and nothing can be sent. The fake needs no credential and makes no network call. It is priced only so the Gateway's budget and large-request checks run exactly as they would for a real provider. It is reached only through `server.ts`.

**The deterministic responder.** `DeterministicFakeAdapter` (`adapters/fake-responder.ts`) answers every kind from the handles actually issued in the invocation, with schema-valid version 2 output whose every claim cites those handles and whose text says plainly that it is a test interpretation from the deterministic fake provider. For Prepare, its first turn requests `get_evidence` and `get_implementation_state` on the examined set, so the widened plan (ADR-0071) is exercised. `ARCHITECTURE_INTELLIGENCE_FAKE_SCENARIO` selects `interpretation` (default), `nothing_to_add`, `invalid_output`, `refusal` or `provider_error`. `ARCHITECTURE_INTELLIGENCE_FAKE_RESOLVED_MODEL` selects which fake model the response reports as resolved, accepting only the fake naming pattern. The 7B.1 scripted `FakeModelAdapter` remains for CI and the evaluation harness.

**The test manifest overlay.** `testManifestOverlay` (`prompts/test-overlay.ts`) returns an evaluated-model check only under exactly the fake provider's conditions, and null in every other configuration, including every production server. Under it, the two fake models in `TEST_OVERLAY_MODELS` count as evaluated for each kind's **current** (version 2) prompt, for the `fake` provider only, in addition to whatever the committed manifest lists. It:

- never lists a real provider: a fake model name under any other provider key is not evaluated;
- never changes `PROMPT_MANIFEST`, whose `evaluatedModels` stay empty for every version of every kind;
- never covers a retired prompt version;
- lists two fake resolved models so acceptance can show that a change of resolved model behind an unchanged requested model ends reuse (PD-13a, ADR-0068); a third fake resolution is never listed, so "The provider returned a model that has not been evaluated" can be shown too.

`deployment()` (`server.ts`) uses the overlay as its evaluated-model check only when the active provider is the fake; otherwise it uses the committed manifest.

**Configured but unevaluated is honest.** `configuredModel` names the provider and requested model the environment declares, with or without a credential, so a holder sees "Not yet available: no model has been evaluated for this kind of interpretation." when a real provider is named and nothing is evaluated, and "no external processing provider is configured here" when none is. Nothing is sent on the strength of this alone.

**Proof.** `test-overlay.test.ts` proves the fake and the overlay are active only outside production under `synthetic_only`, are refused in production and in `off` and `enabled`, never fall back to a real provider, never overlay a real provider, a retired version or a third fake resolution, and that the committed manifest lists no evaluated model with every version 1 prompt retired. `imports.test.ts` proves no application module requests `persist`.

**Browser acceptance passes.** Production-style build against the reset seed: (1) mode `off`, every deterministic surface for every internal role; (2) `synthetic_only` with a real provider named, no credential and an empty manifest, showing the "Not yet available" states; (3) `synthetic_only` with the fake provider on a non-production server, the full interpretation flow per kind; (4) the same at mobile width. Each pass covers every internal role and client user and includes a leak crawl for interpretation text, existence or counts for non-holders. Because the fake requires `NODE_ENV` other than `production`, passes 3 and 4 run on a non-production server.

## Consequences

- Step A can be accepted on its own evidence, with no credential, no provider call and no change to the evaluated manifest.
- A production deployment cannot reach the fake, the overlay or any interpretation from an unevaluated model, whatever its environment variables say.
- Every output the fake produces is visibly a test interpretation, so a screenshot or a kept fake inference cannot be mistaken for a real reading. Fake inferences can exist only on synthetic engagements.
- Activation of each kind remains a separate, reviewed change on Kerrick's instruction, preceded by the seed-only evaluation and its committed report.
