import Link from "next/link";
import {
  citationElement,
  citationLabel,
  type InterpretationView,
} from "@/domain/architecture-intelligence/experience/view";
import {
  BEARING_CONSISTENCY,
  EVIDENCE_LIMIT_NOTE,
  REALIZATION_READINGS,
} from "@/domain/architecture-intelligence/experience/words";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * An interpretation, rendered calmly and apart from governed records: no
 * severity colour, no alert icon, citations as reference codes and versions
 * that link to the records cited. Exactly the validated text, nothing added.
 */

function Cite({ view, handle, slug }: { view: InterpretationView; handle: string; slug: string }) {
  const label = citationLabel(view, handle);
  const element = citationElement(view, handle);
  const cls =
    "inline-flex rounded-sm border border-rule px-1 font-mono text-[11px] leading-5 text-ink-muted";
  return element ? (
    <Link
      href={`/internal/engagements/${slug}/architecture/elements/${element}`}
      className={`${cls} hover:text-ink hover:underline`}
    >
      {label}
    </Link>
  ) : (
    <span className={cls}>{label}</span>
  );
}

function Cites({
  view,
  handles,
  slug,
}: {
  view: InterpretationView;
  handles: string[];
  slug: string;
}) {
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {handles.map((h) => (
        <Cite key={h} view={view} handle={h} slug={slug} />
      ))}
    </span>
  );
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

function Payload({ view, slug }: { view: InterpretationView; slug: string }) {
  const p = view.payload;
  switch (view.kind) {
    case "explanation":
      return (
        <div className="space-y-1">
          <p className="text-xs tracking-wide text-ink-subtle uppercase">Connection</p>
          <p className="text-sm text-ink">
            {str(p.connection)}
            <Cites view={view} handles={[str(p.condition_ref)]} slug={slug} />
          </p>
        </div>
      );
    case "tension":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {[str(p.statement_a), str(p.statement_b)].map((h, i) => (
              <div key={h} className="rounded-sm border border-rule px-3 py-2">
                <p className="text-xs text-ink-subtle">{i === 0 ? "First" : "Second"}</p>
                <Cite view={view} handle={h} slug={slug} />
              </div>
            ))}
          </div>
          <p className="text-sm text-ink">
            <span className="text-ink-subtle">Nature: </span>
            {str(p.nature)}
          </p>
          <p className="text-sm text-ink">
            <span className="text-ink-subtle">What would establish it: </span>
            {str(p.what_would_resolve)}
          </p>
        </div>
      );
    case "evidence_bearing":
      return (
        <div className="space-y-1">
          <p className="text-sm text-ink">
            <span className="text-ink-subtle">Apparent bearing: </span>
            {str(p.apparent_bearing)}
          </p>
          <p className="text-sm text-ink">
            <span className="text-ink-subtle">Consistent with the recorded stance: </span>
            {BEARING_CONSISTENCY[str(p.consistent_with_recorded_stance)] ??
              str(p.consistent_with_recorded_stance)}
          </p>
          <p className="text-xs text-ink-subtle">{EVIDENCE_LIMIT_NOTE}</p>
        </div>
      );
    case "review_brief": {
      const points = Array.isArray(p.points)
        ? (p.points as { about: string; why: string; cites: string[] }[])
        : [];
      return (
        <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
          {points.map((pt, i) => (
            <li key={i}>
              <Cite view={view} handle={pt.about} slug={slug} /> {pt.why}
              <Cites view={view} handles={pt.cites} slug={slug} />
            </li>
          ))}
        </ol>
      );
    }
    case "realization_reading": {
      const readings = Array.isArray(p.readings)
        ? (p.readings as { intent_ref: string; observation: string; reading: string }[])
        : [];
      return (
        <ul className="space-y-2 text-sm text-ink">
          {readings.map((r, i) => (
            <li key={i}>
              <Cite view={view} handle={r.intent_ref} slug={slug} />{" "}
              <span className="text-ink-muted">
                {REALIZATION_READINGS[r.reading] ?? r.reading}.
              </span>{" "}
              {r.observation}
            </li>
          ))}
        </ul>
      );
    }
  }
}

export function InterpretationBody({
  view,
  slug,
  dimmed = false,
}: {
  view: InterpretationView;
  slug: string;
  dimmed?: boolean;
}) {
  const pv = view.provenance;
  return (
    <div className={cn("space-y-3 border-l-2 border-rule pl-3", dimmed && "opacity-60")}>
      <p className="text-sm text-ink">{view.assertion}</p>
      <ul className="space-y-1.5">
        {view.claims.map((c, i) => (
          <li key={i} className="text-sm text-ink">
            {c.text}
            <Cites view={view} handles={c.cites} slug={slug} />
          </li>
        ))}
      </ul>
      <Payload view={view} slug={slug} />
      {view.uncertainty ? (
        <p className="text-sm text-ink-muted">
          <span className="text-ink-subtle">Uncertainty: </span>
          {view.uncertainty}
        </p>
      ) : null}
      {view.examination.length > 0 ? (
        <div>
          <p className="text-xs tracking-wide text-ink-subtle uppercase">To examine</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink-muted">
            {view.examination.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <details className="text-xs text-ink-subtle">
        <summary className="cursor-pointer hover:text-ink">How this was produced</summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <dt>Generated</dt>
          <dd>{formatDateTime(pv.requestedAt)}</dd>
          {pv.keptAt ? (
            <>
              <dt>Kept</dt>
              <dd>
                {formatDateTime(pv.keptAt)}
                {pv.requestedByName ? ` by ${pv.requestedByName}` : ""}
              </dd>
            </>
          ) : null}
          <dt>Provider</dt>
          <dd>{pv.providerKey}</dd>
          <dt>Model</dt>
          <dd>
            {pv.resolvedModel}
            {pv.resolvedModel !== pv.requestedModel ? ` (requested ${pv.requestedModel})` : ""}
          </dd>
          <dt>Prompt</dt>
          <dd>
            {pv.promptVersion}, policy {pv.generationPolicyVersion}, tools {pv.toolContractVersion}
          </dd>
        </dl>
      </details>
    </div>
  );
}
