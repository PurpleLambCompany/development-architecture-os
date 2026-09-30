import { cn } from "@/lib/utils";

export type Tone = "neutral" | "accent" | "positive" | "attention" | "negative";

const toneClass: Record<Tone, string> = {
  neutral: "border-rule-strong text-ink-muted",
  accent: "border-accent/30 bg-accent-soft text-accent",
  positive: "border-positive/30 bg-positive-soft text-positive",
  attention: "border-attention/30 bg-attention-soft text-attention",
  negative: "border-negative/30 bg-negative-soft text-negative",
};

/** A restrained status indicator: text with a hairline border, never decoration. */
export function StatusTag({ tone = "neutral", children }: { tone?: Tone; children: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium tracking-wide uppercase",
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}
