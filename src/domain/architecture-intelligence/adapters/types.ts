import type { FunctionToolDefinition } from "../tools/registry";

/**
 * The provider adapter boundary (proposal §11, ADR-0062). DSA owns the
 * tools, schemas, prompts, context and citations; an adapter only translates
 * request and response shapes. FunctionToolDefinition is the only tool type
 * the interface can express, so provider-hosted tools (web search, file
 * search, code execution, MCP, computer use) cannot be requested. There is
 * no conversation state: every turn sends the whole exchange again.
 */

export type DataBlock = {
  handle: string;
  record_type: string;
  data_class: string;
  withheld: boolean;
  withheld_reason?: string;
  content?: unknown;
};

export type Turn =
  | { type: "data"; blocks: DataBlock[] }
  | { type: "tool_call"; callId: string; name: string; arguments: string }
  | { type: "tool_result"; callId: string; blocks: DataBlock[]; refused?: string };

export type NormalizedModelRequest = {
  instructions: string;
  task: string;
  input: Turn[];
  tools: FunctionToolDefinition[];
  outputSchema: { name: string; schema: Record<string, unknown> };
  model: { requested: string; reasoningEffort?: string; maxOutputTokens: number };
  timeoutMs: number;
};

export type Usage = { inputTokens: number; outputTokens: number; reasoningTokens: number };

export type ProviderErrorClass =
  "timeout" | "rate_limited" | "provider_unavailable" | "bad_request" | "auth" | "other";

export type NormalizedModelResponse =
  | {
      kind: "tool_calls";
      calls: { callId: string; name: string; arguments: string }[];
      usage: Usage;
      resolvedModel: string;
      providerRequestId: string;
    }
  | {
      kind: "output";
      json: unknown;
      usage: Usage;
      resolvedModel: string;
      providerRequestId: string;
    }
  | { kind: "refusal"; usage: Usage; resolvedModel: string; providerRequestId: string }
  | { kind: "error"; errorClass: ProviderErrorClass; retryable: boolean; usage?: Usage };

export interface ModelAdapter {
  readonly providerKey: string;
  invoke(request: NormalizedModelRequest): Promise<NormalizedModelResponse>;
}

export const NO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 };
