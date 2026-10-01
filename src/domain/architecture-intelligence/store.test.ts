import { describe, expect, it } from "vitest";
import { supabaseStore, trustedRecording } from "./store";

type Call = { fn: string; args: Record<string, unknown> };
function fakeClient(calls: Call[]) {
  return {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return { data: "request-id", error: null };
    },
  } as never;
}

describe("the server-only recording path (ADR-0069)", () => {
  it("records only through record_architecture_intelligence_request_for, for the verified user", async () => {
    const calls: Call[] = [];
    const record = trustedRecording(() => fakeClient(calls), "user-1");
    const result = await record("eng-1", { outcome: "returned" }, { assertion: "A." });
    expect(result).toEqual({ requestId: "request-id" });
    expect(calls).toEqual([
      {
        fn: "record_architecture_intelligence_request_for",
        args: {
          p_requested_by: "user-1",
          p_engagement_id: "eng-1",
          p_request: { outcome: "returned" },
          p_inference: { assertion: "A." },
        },
      },
    ]);
  });

  it("never records through the user's own session", async () => {
    const calls: Call[] = [];
    const store = supabaseStore(fakeClient(calls));
    const result = await store.record("eng-1", { outcome: "returned" }, { assertion: "A." });
    expect(result).toEqual({ error: { code: "42501", message: "Recording is server-only" } });
    expect(calls).toEqual([]);
  });
});
