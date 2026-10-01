import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database";
import {
  FAKE_MODEL,
  FAKE_PROVIDER_KEY,
  FakeModelAdapter,
  fake,
  type FakeStep,
} from "../adapters/fake";
import { OpenAIAdapter } from "../adapters/openai";
import { processingMode, providerConfig } from "../config";
import {
  invokeArchitectureIntelligence,
  type GatewayDeps,
  type GatewayResult,
  type ProviderSettings,
} from "../gateway";
import { currentPrompt, GENERATION_POLICY, PROMPT_MANIFEST } from "../prompts/manifest";
import { supabaseStore, trustedRecording } from "../store";
import { TOOL_CONTRACT_VERSION } from "../tools/registry";
import {
  PRE_MODEL_OUTCOMES,
  type InferenceKind,
  type InvocationMode,
  type Subject,
} from "../types";
import { answer } from "./answers";
import { FAKE_PROVIDER, fakeEvaluated } from "./fixtures";

/**
 * The live evaluation runner: `pnpm ai:eval` (proposal §19.3).
 *
 * Runs against the local database with the seed, as seed users, so the
 * capability, authorization, RLS, audit and Tool Contract are exercised for
 * real. Refuses to run unless ARCHITECTURE_INTELLIGENCE_MODE=synthetic_only.
 * By default the model is the fake adapter (a pipeline evaluation). With
 * AI_EVAL_PROVIDER=openai and a configured provider it calls the real
 * provider, in ephemeral evaluation runs only, for manual grading.
 * AI_EVAL_REPORT=<path> writes a metadata-only report (OD-14: seed data
 * only; never real engagement content).
 *
 * Skipped unless AI_EVAL=1, so `pnpm test` never touches a database or a
 * provider.
 */

const enabled = process.env.AI_EVAL === "1";
if (enabled && existsSync(".env.local")) process.loadEnvFile(".env.local");

const MERIDIAN = "e0000000-0000-4000-8000-000000000001";
const WORKFORCE = "e0000000-0000-4000-8000-000000000002";
const HARBOR = "e0000000-0000-4000-8000-000000000003";
const PASSWORD = "dsa-demo-password";
const USER_IDS: Record<string, string> = {
  "researcher@tplco.test": "10000000-0000-4000-8000-000000000004",
};
const EXCLUDED_TEXT = [
  "Proprietary Readiness Diagnostic",
  "Readiness diagnostic workbook",
  "Licensed lab market report",
  "Internal diagnostic scoring",
  "Licensed vacancy series",
];
const EXCLUDED_IDS = [
  "f7c00000-0000-4000-8000-000000000001",
  "f7c00000-0000-4000-8000-000000000002",
];

type Client = SupabaseClient<Database>;
const clients = new Map<string, Client>();
async function as(email: string): Promise<Client> {
  const cached = clients.get(email);
  if (cached) return cached;
  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Sign-in failed for ${email}`);
  clients.set(email, client);
  return client;
}

// The server-only recording path (ADR-0069), as the DSA server uses it.
let serverClient: Client | null = null;
function server(): Client {
  serverClient ??= createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return serverClient;
}
async function storeFor(email: string) {
  const client = await as(email);
  const { data } = await client.auth.getUser();
  return supabaseStore(client, trustedRecording(server, data.user!.id));
}

const realProvider = process.env.AI_EVAL_PROVIDER === "openai" ? providerConfig() : null;

type Row = { case: string; kind: string; outcome: string; checks: string; model: string };
const report: Row[] = [];

async function run(
  email: string,
  input: { engagementId: string; kind: InferenceKind; subject: Subject; mode?: InvocationMode },
  steps: FakeStep[] = [answer(input.kind)],
  options: {
    mode?: () => "off" | "synthetic_only" | "enabled";
    provider?: ProviderSettings;
    real?: boolean;
  } = {},
): Promise<{ result: GatewayResult; adapter: FakeModelAdapter | OpenAIAdapter }> {
  const real = options.real && realProvider;
  const adapter = real
    ? new OpenAIAdapter({ apiKey: realProvider.apiKey, baseUrl: realProvider.baseUrl })
    : new FakeModelAdapter(steps);
  const deps: GatewayDeps = {
    store: await storeFor(email),
    adapter,
    provider: real ? realProvider : (options.provider ?? FAKE_PROVIDER),
    mode: options.mode ?? (() => processingMode()),
    ...(real ? {} : { isEvaluatedModel: fakeEvaluated }),
  };
  const result = await invokeArchitectureIntelligence(deps, {
    mode: "persist",
    ...input,
    ...(real ? { mode: "ephemeral" as const, evaluation: true } : {}),
  });
  return { result, adapter };
}

function sentText(adapter: FakeModelAdapter | OpenAIAdapter): string {
  return adapter instanceof FakeModelAdapter ? JSON.stringify(adapter.sent) : "";
}

function record(
  name: string,
  kind: string,
  result: GatewayResult,
  checks: string[],
  model = FAKE_MODEL,
) {
  const preModel = PRE_MODEL_OUTCOMES.includes(result.outcome);
  report.push({
    case: name,
    kind,
    outcome: result.outcome,
    checks: checks.join("; ") || "pass",
    model: preModel ? "(none: refused before sending)" : model,
  });
}

async function requestsSeenBy(email: string, engagementId: string) {
  const { data } = await (
    await as(email)
  )
    .from("architecture_intelligence_requests")
    .select("id, outcome, input_tokens, output_tokens, estimated_cost_usd, resolved_model")
    .eq("engagement_id", engagementId);
  return data ?? [];
}

async function setAuthorization(
  engagementId: string,
  state: "authorized" | "not_authorized",
  budget = 25,
  classes?: string[],
) {
  const client = await as("principal@tplco.test");
  const { error } = await client.rpc(
    "set_engagement_ai_authorization",
    state === "authorized"
      ? {
          p_engagement_id: engagementId,
          p_state: state,
          p_data_classes: classes ?? [
            "published_architecture",
            "working_architecture",
            "project_intelligence",
            "evidence_metadata",
          ],
          p_provider_key: "openai",
          p_processing_region: "us",
          p_basis_kind: "synthetic_evaluation",
          p_basis_reference: "Seed evaluation (ai:eval)",
          p_monthly_budget_usd: budget,
        }
      : {
          p_engagement_id: engagementId,
          p_state: state,
          p_basis_note: "Evaluation: revocation scenario.",
        },
  );
  if (error) throw new Error(`Authorization change failed: ${error.code}`);
}

async function setOverride(email: string, engagementId: string, granted: boolean | null) {
  const pa = await as("principal@tplco.test");
  const { data: member } = await pa
    .from("engagement_members")
    .select("id")
    .eq("engagement_id", engagementId)
    .eq("user_id", USER_IDS[email]!)
    .single();
  if (!member) throw new Error(`No member ${email}`);
  const table = pa.from("engagement_member_capability_overrides");
  const { error } =
    granted === null
      ? await table
          .delete()
          .eq("engagement_member_id", member.id)
          .eq("capability", "use_architecture_intelligence")
      : await table.upsert(
          {
            engagement_member_id: member.id,
            engagement_id: engagementId,
            capability: "use_architecture_intelligence",
            granted,
            reason: "Evaluation scenario",
          },
          { onConflict: "engagement_member_id,capability" },
        );
  if (error) throw new Error(`Override change failed: ${error.code} ${error.message}`);
}

const subjects: Partial<Record<string, Subject>> = {};

describe.skipIf(!enabled)(
  "Architecture Intelligence live evaluation (seed data, synthetic_only)",
  () => {
    beforeAll(async () => {
      if (processingMode() !== "synthetic_only")
        throw new Error("ai:eval runs only with ARCHITECTURE_INTELLIGENCE_MODE=synthetic_only");
      const db = await as("architect@tplco.test");
      const code = async (engagementId: string, reference: string) => {
        const { data } = await db
          .from("architecture_elements")
          .select("id")
          .eq("engagement_id", engagementId)
          .eq("reference_code", reference)
          .single();
        return data!.id;
      };
      const cap = await code(MERIDIAN, "CAP-004");
      const knw = await code(MERIDIAN, "KNW-001");
      const { data: rel } = await db
        .from("architecture_relationships")
        .select("target_element_id")
        .eq("source_element_id", cap)
        .is("retired_at", null)
        .limit(1)
        .single();
      const { data: edge } = await db.rpc("edge_items", {
        p_engagement_id: MERIDIAN,
        p_as_of: null as never,
        p_subject_type: null as never,
        p_subject_id: null as never,
        p_include_judged: true,
      });
      const item = (edge ?? []).find((i) => i.subject_type === "element" && i.home !== "practice");
      const { data: link } = await db
        .from("element_evidence_links")
        .select("id, evidence_sources!inner(ip_classification)")
        .eq("element_id", knw)
        .not(
          "evidence_sources.ip_classification",
          "in",
          "(tplco_method_ip,licensed_third_party_source)",
        )
        .limit(1)
        .single();
      subjects.impact = { type: "impact_trace", elementId: cap };
      subjects.revision = { type: "revision", elementId: cap };
      subjects.edge = {
        type: "edge_item",
        elementId: item!.subject_id,
        ruleKey: item!.rule_key,
        fingerprint: item!.fingerprint,
      };
      subjects.pair = {
        type: "element_pair",
        elementId: cap,
        secondElementId: rel!.target_element_id,
      };
      subjects.evidence = {
        type: "evidence_link",
        elementId: knw,
        linkId: link!.id,
        linkType: "element_link",
      };
      subjects.review = { type: "element", elementId: await code(HARBOR, "REV-001") };
      subjects.initiative = { type: "element", elementId: await code(HARBOR, "IMP-001") };
    });

    afterAll(() => {
      const path = process.env.AI_EVAL_REPORT;
      if (!path) return;
      // The prompt each kind is sent with now (an earlier version is kept
      // in the manifest only to verify inferences recorded under it).
      const prompts = (Object.keys(PROMPT_MANIFEST) as InferenceKind[]).map((k) => {
        const p = currentPrompt(k);
        return `| ${k} | ${p.promptVersion} | \`${p.contentHash}\` |`;
      });
      const lines = [
        `# Architecture Intelligence evaluation: ${realProvider ? "provider" : "pipeline (fake adapter)"}, ${new Date().toISOString().slice(0, 10)}`,
        "",
        "Seed data only (synthetic engagements). Metadata only: no prompt, context or output text (OD-14).",
        "",
        `- Generation policy: ${GENERATION_POLICY.version} (\`${GENERATION_POLICY.contentHash}\`)`,
        `- Tool contract version: ${TOOL_CONTRACT_VERSION}`,
        `- Provider: ${realProvider ? realProvider.providerKey : FAKE_PROVIDER_KEY}; requested model: ${realProvider ? realProvider.requestedModel : FAKE_MODEL}`,
        "",
        "| Kind | Prompt version | Content hash |",
        "| --- | --- | --- |",
        ...prompts,
        "",
        "| Case | Kind | Outcome | Automated checks | Resolved model |",
        "| --- | --- | --- | --- | --- |",
        ...report.map((r) => `| ${r.case} | ${r.kind} | ${r.outcome} | ${r.checks} | ${r.model} |`),
        "",
        realProvider
          ? "Manual quality grades: to be recorded by the TPLCo reviewer."
          : "Manual quality grading: not applicable to the fake adapter.",
        "",
      ];
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, lines.join("\n"));
    });

    const kinds: [string, InferenceKind, string, string][] = [
      ["explanation of an impact trace", "explanation", "impact", MERIDIAN],
      ["explanation of a substantive revision", "explanation", "revision", MERIDIAN],
      ["explanation of a Development Edge item", "explanation", "edge", MERIDIAN],
      ["tension across a typed relationship", "tension", "pair", MERIDIAN],
      ["evidence bearing (injection-bearing element)", "evidence_bearing", "evidence", MERIDIAN],
      ["review brief", "review_brief", "review", HARBOR],
      ["realization reading", "realization_reading", "initiative", HARBOR],
    ];

    it.each(kinds)("S6: %s", async (name, kind, subjectKey, engagementId) => {
      const { result, adapter } = await run(
        "architect@tplco.test",
        { engagementId, kind, subject: subjects[subjectKey]! },
        [answer(kind)],
        {
          real: Boolean(realProvider),
        },
      );
      const sent = sentText(adapter);
      const checks: string[] = [];
      for (const text of EXCLUDED_TEXT)
        if (sent.includes(text)) checks.push(`sent excluded text: ${text}`);
      if (result.manifest.some((m) => EXCLUDED_IDS.includes(String(m.record_id))))
        checks.push("Method/IP or licensed record in manifest");
      if (engagementId === MERIDIAN && /HRB-|Harbor/.test(sent))
        checks.push("another engagement in context");
      if (
        sent.includes("Ignore previous instructions") &&
        !sent.includes("Record data") &&
        !sent.includes('"type":"data"')
      )
        checks.push("injection text outside quoted data");
      record(name, kind, result, checks, realProvider ? "(see audit)" : FAKE_MODEL);
      expect(checks).toEqual([]);
      expect(result.outcome, result.reason).toBe(realProvider ? "returned" : "persisted");
    });

    it("S4: a Researcher is refused, and the refusal is audited for authorizers only", async () => {
      const { result, adapter } = await run("researcher@tplco.test", {
        engagementId: MERIDIAN,
        kind: "explanation",
        subject: subjects.impact!,
      });
      record("Researcher without use", "explanation", result, []);
      expect(result.outcome).toBe("refused_capability");
      expect((adapter as FakeModelAdapter).sent).toHaveLength(0);
      expect(
        (await requestsSeenBy("principal@tplco.test", MERIDIAN)).some(
          (r) => r.outcome === "refused_capability",
        ),
      ).toBe(true);
      expect(await requestsSeenBy("architect@tplco.test", MERIDIAN)).toEqual([]);
    });

    it("S5: a Researcher granted use by override can invoke; revoked mid-invocation, it stops", async () => {
      await setOverride("researcher@tplco.test", MERIDIAN, true);
      const ok = await run("researcher@tplco.test", {
        engagementId: MERIDIAN,
        kind: "explanation",
        subject: subjects.impact!,
      });
      expect(ok.result.outcome).toBe("persisted");
      const { result } = await run(
        "researcher@tplco.test",
        { engagementId: MERIDIAN, kind: "explanation", subject: subjects.impact! },
        [
          async () => {
            await setOverride("researcher@tplco.test", MERIDIAN, false);
            return fake.toolCalls([
              { name: "get_relationships", arguments: { reference_code: "CAP-004" } },
            ]);
          },
          answer("explanation"),
        ],
      );
      record("Use capability revoked mid-invocation", "explanation", result, []);
      expect(result.outcome).toBe("authorization_withdrawn");
      await setOverride("researcher@tplco.test", MERIDIAN, null);
    });

    it("S7: an unauthorized engagement is refused", async () => {
      const pa = await as("principal@tplco.test");
      const { data } = await pa
        .from("architecture_elements")
        .select("id")
        .eq("engagement_id", WORKFORCE)
        .limit(1)
        .maybeSingle();
      const { result } = await run("principal@tplco.test", {
        engagementId: WORKFORCE,
        kind: "explanation",
        subject: { type: "impact_trace", elementId: data?.id ?? subjects.impact!.elementId },
      });
      record("Unauthorized engagement", "explanation", result, []);
      expect(result.outcome).toBe("refused_authorization");
    });

    it("S8: mode off refuses before any read", async () => {
      const { result, adapter } = await run(
        "architect@tplco.test",
        { engagementId: MERIDIAN, kind: "explanation", subject: subjects.impact! },
        undefined,
        { mode: () => "off" },
      );
      record("Mode off", "explanation", result, []);
      expect(result.outcome).toBe("refused_mode");
      expect((adapter as FakeModelAdapter).sent).toHaveLength(0);
    });

    it("refuses an output from a model that has not been evaluated (OD-8)", async () => {
      const { result } = await run(
        "architect@tplco.test",
        { engagementId: MERIDIAN, kind: "explanation", subject: subjects.impact! },
        [answer("explanation", {}, "dsa-fake-model-2")],
      );
      record("Resolved model changed", "explanation", result, [], "dsa-fake-model-2");
      expect(result.outcome).toBe("model_not_evaluated");
      const audit = await requestsSeenBy("principal@tplco.test", MERIDIAN);
      expect(
        audit.some(
          (r) => r.outcome === "model_not_evaluated" && r.resolved_model === "dsa-fake-model-2",
        ),
      ).toBe(true);
    });

    it("enforces the monthly budget", async () => {
      await setAuthorization(MERIDIAN, "authorized", 0.01);
      const { result } = await run("architect@tplco.test", {
        engagementId: MERIDIAN,
        kind: "explanation",
        subject: subjects.impact!,
      });
      record("Budget below the request estimate", "explanation", result, []);
      expect(result.outcome).toBe("refused_budget");
      await setAuthorization(MERIDIAN, "authorized", 25);
    });

    it("S9: revocation during an invocation stops it; existing inferences are kept", async () => {
      const pa = await as("principal@tplco.test");
      const before = (
        await pa.from("architecture_inferences").select("id").eq("engagement_id", MERIDIAN)
      ).data!.length;
      const { result } = await run(
        "architect@tplco.test",
        { engagementId: MERIDIAN, kind: "explanation", subject: subjects.impact! },
        [
          async () => {
            await setAuthorization(MERIDIAN, "not_authorized");
            return fake.toolCalls([
              { name: "get_relationships", arguments: { reference_code: "CAP-004" } },
            ]);
          },
          answer("explanation"),
        ],
      );
      record("Authorization revoked mid-invocation", "explanation", result, []);
      expect(result.outcome).toBe("authorization_withdrawn");
      expect(
        (await pa.from("architecture_inferences").select("id").eq("engagement_id", MERIDIAN)).data!
          .length,
      ).toBe(before);
      const after = await run("architect@tplco.test", {
        engagementId: MERIDIAN,
        kind: "explanation",
        subject: subjects.impact!,
      });
      expect(after.result.outcome).toBe("refused_authorization");
      await setAuthorization(MERIDIAN, "authorized");
    });

    it("S10: publishing a new version of a basis element makes its inference stale", async () => {
      const architect = await as("architect@tplco.test");
      const { result } = await run("architect@tplco.test", {
        engagementId: MERIDIAN,
        kind: "tension",
        subject: subjects.pair!,
      });
      expect(result.outcome).toBe("persisted");
      const { data: inference } = await architect
        .from("architecture_inferences")
        .select("id")
        .eq("request_id", result.requestId!)
        .single();
      const state = async () =>
        (
          await architect.rpc("architecture_inference_state", {
            p_engagement_id: MERIDIAN,
            p_inference_id: inference!.id,
          })
        ).data![0]!;
      expect((await state()).state).toBe("current");
      await architect.from("architecture_elements").select("id").eq("id", subjects.pair!.elementId);
      const { error } = await architect.rpc("publish_element_version", {
        p_element_id: subjects.pair!.elementId,
        p_change_summary: "Evaluation: a further revision.",
      } as never);
      expect(error).toBeNull();
      const now = await state();
      record("New version published under a basis", "tension", result, [
        `then ${now.state} (${now.stale_reasons?.join(", ")})`,
      ]);
      expect(now.state).toBe("stale");
      expect(now.stale_reasons).toContain("newer_version_published");
    });

    it("no inference, basis or audit row reaches anyone who should not read it", async () => {
      const readers = {
        "principal@tplco.test": { inferences: true, requests: true },
        "architect@tplco.test": { inferences: true, requests: false },
        "researcher@tplco.test": { inferences: false, requests: false },
        "projectadmin@tplco.test": { inferences: false, requests: false },
        "finance@tplco.test": { inferences: false, requests: false },
        "sysadmin@tplco.test": { inferences: false, requests: false },
        "sponsor@meridian.test": { inferences: false, requests: false },
        "lead@meridian.test": { inferences: false, requests: false },
        "lead@harbor.test": { inferences: false, requests: false },
        "advisor@consulting.test": { inferences: false, requests: false },
      };
      for (const [email, may] of Object.entries(readers)) {
        const db = await as(email);
        const inferences =
          (await db.from("architecture_inferences").select("id, assertion")).data ?? [];
        const basis = (await db.from("architecture_inference_basis").select("id")).data ?? [];
        const requests =
          (await db.from("architecture_intelligence_requests").select("id")).data ?? [];
        expect(inferences.length > 0, `${email} inferences`).toBe(may.inferences);
        expect(basis.length > 0, `${email} basis`).toBe(may.inferences);
        expect(requests.length > 0, `${email} requests`).toBe(may.requests);
      }
    });
  },
);
