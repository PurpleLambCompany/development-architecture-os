import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const moduleDir = join(root, "src/domain/architecture-intelligence");

function files(path: string): string[] {
  return readdirSync(path).flatMap((name) => {
    const full = join(path, name);
    return statSync(full).isDirectory() ? files(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}
const all = files(join(root, "src"));
const imports2 = (text: string) => [...text.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
const imports = (file: string) => imports2(readFileSync(file, "utf8"));

describe("module boundaries (proposal §10.1, §29.2)", () => {
  it("lets only the Gateway's wiring and tests import the provider adapters", () => {
    for (const file of all) {
      const rel = relative(moduleDir, file);
      if (!imports(file).some((i) => /adapters\/(openai|fake)/.test(i))) continue;
      expect(
        [
          "server.ts",
          "evaluation/fixtures.ts",
          "evaluation/answers.ts",
          "evaluation/cases.ts",
          "prompts/test-overlay.ts",
        ].includes(rel) || rel.endsWith(".test.ts"),
        rel,
      ).toBe(true);
    }
  });

  it("keeps the Gateway away from server actions and mutation modules", () => {
    const experience = join(moduleDir, "experience");
    for (const file of files(moduleDir).filter(
      (f) => !/\/(actions|queries)\.ts$/.test(f) && !f.startsWith(experience),
    )) {
      for (const i of imports(file)) {
        expect(i, file).not.toMatch(/actions|next\/cache|next\/navigation/);
        // Only server.ts holds the service-role client, for the recording path alone.
        if (!file.endsWith("/server.ts")) expect(i, file).not.toMatch(/@\/lib\/supabase\/admin/);
      }
    }
    // The action module records an authorization only; it never reaches the Gateway or a provider.
    for (const i of imports(join(moduleDir, "actions.ts"))) {
      expect(i).not.toMatch(/^\.\/(gateway|server|adapters|store|tools)/);
    }
    for (const i of imports(join(moduleDir, "queries.ts"))) {
      expect(i).not.toMatch(/^\.\/(gateway|server|adapters|tools)/);
    }
    // Nothing below the experience layer reaches up into it.
    for (const file of files(moduleDir).filter((f) => !f.startsWith(experience))) {
      for (const i of imports(file)) expect(i, file).not.toMatch(/experience/);
    }
    // The experience layer reaches the Gateway only through server.ts, never a provider or tool.
    for (const file of files(experience).filter((f) => !f.endsWith(".test.ts"))) {
      for (const i of imports(file)) {
        expect(i, file).not.toMatch(/adapters|tools\/(?!registry$)|test-overlay/);
      }
    }
  });

  it("records only through the server-only path, for the verified user (ADR-0069)", () => {
    const serverTs = readFileSync(join(moduleDir, "server.ts"), "utf8");
    // The service-role client is created once, only to build the trusted recorder.
    expect(serverTs.match(/createSupabaseAdminClient/g)).toHaveLength(2); // the import and the one use
    expect(serverTs).toMatch(/trustedRecording\(createSupabaseAdminClient, requestedBy\)/);
    // The requester comes from the Auth server's verification of the session.
    expect(serverTs).toMatch(/await supabase\.auth\.getUser\(\)/);
    const store = readFileSync(join(moduleDir, "store.ts"), "utf8");
    // The trusted client makes exactly one call, to the recording path.
    expect(store.match(/server\(\)\.rpc\(/g)).toHaveLength(1);
    expect(store).toMatch(/server\(\)\.rpc\("record_architecture_intelligence_request_for"/);
    // No module calls the user-scoped recording operation, which no API role may execute.
    for (const file of all) {
      if (file.endsWith(".test.ts")) continue;
      expect(readFileSync(file, "utf8"), file).not.toMatch(
        /rpc\(\s*"record_architecture_intelligence_request"/,
      );
    }
    // The browser-facing actions never pass model text: Keep names a request id only.
    const actions = readFileSync(join(moduleDir, "experience/actions.ts"), "utf8");
    expect(actions).not.toMatch(/p_inference(?!_id)|assertion:/);
  });

  it("requests interpretations ephemerally from the application; only Keep persists (PD-3)", () => {
    for (const file of all) {
      if (file.startsWith(moduleDir) && !file.startsWith(join(moduleDir, "experience"))) continue;
      if (file.endsWith(".test.ts")) continue;
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/mode:\s*["']persist["']/);
    }
    const actions = readFileSync(join(moduleDir, "experience/actions.ts"), "utf8");
    expect(actions).toMatch(/^"use server";/);
    expect(actions.match(/invokeAsUser\(/g)?.length).toBe(1);
    expect(actions).toMatch(/mode:\s*"ephemeral"/);
    for (const f of ["queries.ts", "layer1-queries.ts", "promotion.ts"]) {
      expect(readFileSync(join(moduleDir, "experience", f), "utf8"), f).toMatch(
        /^import "server-only";/,
      );
    }
  });

  it("is never imported by a client component, and the entry point is server-only", () => {
    for (const file of all) {
      const text = readFileSync(file, "utf8");
      if (!/^["']use client["']/m.test(text)) continue;
      // A client component may call the experience server actions and use its pure
      // vocabulary and view helpers; type-only imports carry no code.
      const text2 = text.replace(/import\s+type\s+[^;]+;/g, "");
      for (const i of imports2(text2)) {
        if (!i.includes("domain/architecture-intelligence/")) continue;
        expect(
          [
            "@/domain/architecture-intelligence/types",
            "@/domain/architecture-intelligence/experience/actions",
            "@/domain/architecture-intelligence/experience/view",
            "@/domain/architecture-intelligence/experience/words",
          ],
          `${file}: ${i}`,
        ).toContain(i);
      }
    }
    expect(readFileSync(join(moduleDir, "server.ts"), "utf8")).toMatch(/^import "server-only";/);
  });

  it("is reached from the application only through its page modules and the experience layer", () => {
    for (const file of all) {
      if (file.startsWith(moduleDir)) continue;
      for (const i of imports(file).filter((x) => x.includes("domain/architecture-intelligence"))) {
        expect(
          [
            "@/domain/architecture-intelligence/queries",
            "@/domain/architecture-intelligence/actions",
            "@/domain/architecture-intelligence/types",
            "@/domain/architecture-intelligence/schemas",
            "@/domain/architecture-intelligence/experience/actions",
            "@/domain/architecture-intelligence/experience/queries",
            "@/domain/architecture-intelligence/experience/layer1-queries",
            "@/domain/architecture-intelligence/experience/promotion",
            "@/domain/architecture-intelligence/experience/gate",
            "@/domain/architecture-intelligence/experience/subjects",
            "@/domain/architecture-intelligence/experience/view",
            "@/domain/architecture-intelligence/experience/words",
          ],
          `${file}: ${i}`,
        ).toContain(i);
      }
    }
  });
});
