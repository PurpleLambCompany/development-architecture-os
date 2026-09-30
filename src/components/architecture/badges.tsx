import Link from "next/link";
import {
  AI_REVIEW,
  APPROVAL_STATE,
  LIFECYCLE,
  MATURITY_LABELS,
  PROVENANCE_CLIENT_LABELS,
  PROVENANCE_LABELS,
  type AiReviewState,
  type ApprovalState,
  type ElementLifecycle,
  type MaturityState,
  type ProvenanceType,
} from "@/domain/architecture/catalog";
import { StatusTag } from "@/components/ui/status-tag";
import { cn } from "@/lib/utils";

export function LifecycleTag({ lifecycle }: { lifecycle: ElementLifecycle }) {
  const { label, tone } = LIFECYCLE[lifecycle];
  return <StatusTag tone={tone}>{label}</StatusTag>;
}

export function ApprovalTag({ state }: { state: ApprovalState }) {
  const { label, tone } = APPROVAL_STATE[state];
  return <StatusTag tone={tone}>{label}</StatusTag>;
}

export function AiReviewTag({ state }: { state: AiReviewState }) {
  if (state === "not_applicable") return null;
  const { label, tone } = AI_REVIEW[state];
  return <StatusTag tone={tone}>{label}</StatusTag>;
}

/** Maturity as a word: a judgment, never a score or a progress bar. */
export function MaturityMark({ maturity }: { maturity: MaturityState }) {
  return (
    <span
      className={cn(
        "text-sm",
        maturity === "undefined" ? "text-ink-subtle" : "font-medium text-ink",
      )}
    >
      {MATURITY_LABELS[maturity]}
    </span>
  );
}

export function ProvenanceLabel({
  provenance,
  audience = "internal",
}: {
  provenance: ProvenanceType;
  audience?: "internal" | "client";
}) {
  return (
    <span className="text-xs tracking-wide text-ink-subtle uppercase">
      {audience === "client" ? PROVENANCE_CLIENT_LABELS[provenance] : PROVENANCE_LABELS[provenance]}
    </span>
  );
}

export function InternalMark({ children = "Internal" }: { children?: string }) {
  return (
    <span className="rounded-sm border border-rule-strong px-1.5 py-0.5 text-[10px] font-medium tracking-wider text-ink-muted uppercase">
      {children}
    </span>
  );
}

export function ReferenceCode({ code }: { code: string | null }) {
  return (
    <span className="font-mono text-xs tracking-tight whitespace-nowrap text-ink-muted tabular-nums">
      {code ?? "—"}
    </span>
  );
}

/** A link to an element's page: reference code and title. */
export function ElementLink({
  slug,
  element,
  className,
}: {
  slug: string;
  element: { id: string; reference_code: string | null; title: string };
  className?: string;
}) {
  return (
    <Link
      href={`/internal/engagements/${slug}/architecture/elements/${element.id}`}
      className={cn("group inline-flex items-baseline gap-2", className)}
    >
      <ReferenceCode code={element.reference_code} />
      <span className="text-ink group-hover:underline">{element.title}</span>
    </Link>
  );
}
