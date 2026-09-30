import Link from "next/link";
import {
  APPLICATION_STATE,
  ASSET_STATUS,
  DAM_RELEASE_STATUS,
  VERSION_LIFECYCLE,
  formLabel,
  type DamReleaseStatus,
  type MethodApplicationState,
  type MethodAssetForm,
  type MethodAssetStatus,
  type MethodAssetVersionLifecycle,
} from "@/domain/methodology/catalog";
import { StatusTag } from "@/components/ui/status-tag";
import { cn } from "@/lib/utils";

/** The form as a quiet label: what the asset is, never how good it is. */
export function FormBadge({ form }: { form: MethodAssetForm | null }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium tracking-wide uppercase",
        form ? "border-accent/30 text-accent" : "border-attention/30 text-attention",
      )}
    >
      {formLabel(form)}
    </span>
  );
}

export function VersionTag({ lifecycle }: { lifecycle: MethodAssetVersionLifecycle }) {
  const { label, tone } = VERSION_LIFECYCLE[lifecycle];
  return <StatusTag tone={tone}>{label}</StatusTag>;
}

export function AssetStatusTag({ status }: { status: string }) {
  const known = ASSET_STATUS[status as MethodAssetStatus];
  return known ? <StatusTag tone={known.tone}>{known.label}</StatusTag> : null;
}

export function ReleaseTag({ status }: { status: DamReleaseStatus }) {
  const { label, tone } = DAM_RELEASE_STATUS[status];
  return <StatusTag tone={tone}>{label}</StatusTag>;
}

export function ApplicationStateTag({ state }: { state: MethodApplicationState }) {
  const { label, tone } = APPLICATION_STATE[state];
  return <StatusTag tone={tone}>{label}</StatusTag>;
}

/** "DAM 1.1" as a small chip linking to the release. */
export function ReleaseChip({ label, href }: { label: string; href?: string }) {
  const chip = (
    <span className="rounded-sm border border-rule-strong px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">
      DAM {label}
    </span>
  );
  return href ? (
    <Link href={href} className="hover:opacity-80">
      {chip}
    </Link>
  ) : (
    chip
  );
}

/** Banner over protected practitioner material. */
export function ProtectedBanner() {
  return (
    <p className="rounded-sm border border-attention/30 bg-attention-soft px-3 py-2 text-xs font-medium tracking-wide text-attention uppercase">
      TPLCo protected method IP · internal only · never shown to clients
    </p>
  );
}
