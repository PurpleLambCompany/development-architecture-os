"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import {
  interpret,
  keepAndJudgeInterpretation,
  keepInterpretation,
  judgeInference,
  type InterpretResult,
} from "@/domain/architecture-intelligence/experience/actions";
import type { GateState } from "@/domain/architecture-intelligence/experience/gate";
import type { JudgmentView } from "@/domain/architecture-intelligence/experience/queries";
import {
  viewFromResult,
  type InterpretationView,
} from "@/domain/architecture-intelligence/experience/view";
import {
  FAILURE_COPY,
  JUDGMENT_LABELS,
  LARGE_REQUEST_CONFIRM,
  LAYER_LABELS,
  NOTHING_TO_ADD_REASON_LABEL,
  NOTHING_TO_ADD_TEXT,
  stalePhrase,
  suppressionLine,
} from "@/domain/architecture-intelligence/experience/words";
import type { InferenceKind } from "@/domain/architecture-intelligence/types";
import { formatDate, formatDateTime } from "@/lib/format";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { InterpretationBody } from "./interpretation-view";
import { inferenceJudgmentFields } from "./judgment-fields";

export type KeptView = {
  id: string;
  view: InterpretationView;
  state: "current" | "stale" | "superseded";
  staleReasons: string[];
  judgments: JudgmentView[];
};

type Props = {
  engagementId: string;
  slug: string;
  kind: InferenceKind;
  subjectQuery: string;
  actionLabel: string;
  gate: Exclude<GateState, { state: "absent" }>;
  notOfferedText: string;
  kept: KeptView | null;
  reusable: boolean;
  suppressed: { kind: string; judgedAt: string } | null;
  canJudge: boolean;
  keepLabel: string;
  /** Governed promotions for a current kept interpretation (deterministic targets). */
  promotions: { label: string; href: string }[];
  authorizerHref: string;
  /** The judgment on the deterministic item, kept separate (7B §15.3). */
  itemJudgment?: ReactNode;
};

function Label({ children }: { children: string }) {
  return (
    <h3 className="text-xs font-medium tracking-wide text-ink-subtle uppercase">{children}</h3>
  );
}

function JudgmentLines({ judgments }: { judgments: JudgmentView[] }) {
  if (judgments.length === 0) return null;
  return (
    <ul className="space-y-0.5 text-xs text-ink-muted">
      {judgments.map((j, i) => (
        <li key={i}>
          {j.kind === "promoted"
            ? `Promoted to ${j.promotion_target_code ?? "a governed record"}`
            : (JUDGMENT_LABELS[j.kind] ?? j.kind)}{" "}
          by {j.judged_by_name ?? "a colleague"} on {formatDate(j.judged_at)}
          {j.expires_on ? `, until ${formatDate(j.expires_on)}` : ""}
          {j.reason ? `: ${j.reason}` : ""}
        </li>
      ))}
    </ul>
  );
}

export function InterpretationLayer(props: Props) {
  const router = useRouter();
  const [result, setResult] = useState<InterpretResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"interpret" | "keep" | null>(null);
  const { gate, kept, suppressed } = props;

  const ask = () => {
    if (gate.state === "offered" && gate.large && !window.confirm(LARGE_REQUEST_CONFIRM)) return;
    setError(null);
    setBusy("interpret");
    startTransition(async () => {
      const r = await interpret(props.engagementId, {
        subject: props.subjectQuery,
        interpretAgain: kept !== null || suppressed !== null,
        confirmedLarge: gate.state === "offered" && gate.large,
      });
      if (!r.ok) setError(r.error);
      else setResult(r.data);
    });
  };

  const keep = (requestId: string) => {
    setError(null);
    setBusy("keep");
    startTransition(async () => {
      const r = await keepInterpretation(props.engagementId, requestId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setResult(null);
      router.refresh();
    });
  };

  const fresh = result ? viewFromResult(props.kind, result) : null;
  const askLabel = kept !== null || suppressed !== null ? "Interpret again" : props.actionLabel;
  const canAsk = gate.state === "offered";

  const askButton = (label: string) => (
    <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={ask}>
      {pending && busy === "interpret" ? "Interpreting…" : label}
    </Button>
  );

  // Layer 2 ---------------------------------------------------------------------
  let layer2: ReactNode;
  if (result) {
    const failure = FAILURE_COPY[result.outcome];
    if (result.outcome === "returned" && fresh && result.requestId) {
      layer2 = (
        <div className="space-y-3">
          <p className="text-xs text-ink-subtle">
            Not kept. Nothing is recorded unless you keep it
            {result.keepableUntil ? ` (until ${formatDateTime(result.keepableUntil)})` : ""}.
          </p>
          <InterpretationBody view={fresh} slug={props.slug} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => keep(result.requestId!)}
            >
              {pending && busy === "keep" ? "Keeping…" : props.keepLabel}
            </Button>
            {canAsk ? askButton("Interpret again") : null}
          </div>
        </div>
      );
    } else if (result.outcome === "nothing_to_add") {
      layer2 = (
        <div className="space-y-2">
          <p className="text-sm text-ink">{NOTHING_TO_ADD_TEXT}</p>
          {result.nothingToAddReason ? (
            <p className="text-sm text-ink-muted">
              <span className="text-xs text-ink-subtle">{NOTHING_TO_ADD_REASON_LABEL}: </span>
              {result.nothingToAddReason}
            </p>
          ) : null}
        </div>
      );
    } else {
      layer2 = (
        <div className="space-y-2">
          <p className="text-sm text-ink-muted">
            {failure?.text ?? "The interpretation could not be produced. Nothing was recorded."}
          </p>
          {failure?.retry && canAsk ? askButton("Try again") : null}
        </div>
      );
    }
  } else {
    layer2 = (
      <div className="space-y-3">
        {kept ? (
          <div className="space-y-2">
            <p className="text-xs text-ink-subtle">
              {kept.state === "current"
                ? props.reusable
                  ? `Kept interpretation from ${formatDate(kept.view.provenance.requestedAt)}, still current.`
                  : `Kept interpretation from ${formatDate(kept.view.provenance.requestedAt)}, produced with an earlier prompt or model.`
                : kept.state === "superseded"
                  ? "Superseded by a newer kept interpretation."
                  : "Stale: the records it read have changed."}
            </p>
            {kept.state === "stale" ? (
              <ul className="list-disc pl-5 text-xs text-ink-muted">
                {kept.staleReasons.map((r) => (
                  <li key={r}>{stalePhrase(r)}</li>
                ))}
              </ul>
            ) : null}
            <InterpretationBody
              view={kept.view}
              slug={props.slug}
              dimmed={kept.state !== "current"}
            />
          </div>
        ) : null}
        {gate.state === "offered" ? (
          suppressed ? (
            <div className="space-y-2">
              <p className="text-sm text-ink-muted">
                {suppressionLine(suppressed.kind, formatDate(suppressed.judgedAt))}
              </p>
              {askButton("Interpret again")}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-ink-muted">Offered because {gate.reason}.</p>
              {askButton(askLabel)}
            </div>
          )
        ) : gate.state === "unavailable" ? (
          <p className="text-sm text-ink-muted">
            {gate.text}
            {gate.authorizerLink ? (
              <>
                {" "}
                <Link href={props.authorizerHref} className="underline hover:text-ink">
                  Architecture Intelligence settings
                </Link>
              </>
            ) : null}
          </p>
        ) : (
          <p className="text-sm text-ink-subtle">{props.notOfferedText}</p>
        )}
      </div>
    );
  }

  // Layer 3, on the interpretation ------------------------------------------------
  let onInterpretation: ReactNode = null;
  if (result?.outcome === "returned" && result.requestId && props.canJudge) {
    const requestId = result.requestId;
    onInterpretation = (
      <ActionForm
        trigger="Judge this interpretation"
        fields={inferenceJudgmentFields}
        defaultValues={{ kind: "investigating" }}
        extra={<p className="text-xs text-ink-subtle">Judging keeps this interpretation.</p>}
        action={async (values) => {
          const r = await keepAndJudgeInterpretation(props.engagementId, requestId, values);
          if (r.ok) setResult(null);
          return r;
        }}
        submitLabel="Keep and record judgment"
      />
    );
  } else if (!result && kept) {
    onInterpretation = (
      <div className="space-y-2">
        <JudgmentLines judgments={kept.judgments} />
        {props.canJudge && kept.state === "current" ? (
          <div className="flex flex-wrap items-start gap-2">
            <ActionForm
              trigger="Judge this interpretation"
              fields={inferenceJudgmentFields}
              defaultValues={{ kind: "investigating" }}
              action={judgeInference.bind(null, props.engagementId, kept.id)}
              submitLabel="Record judgment"
            />
            {props.promotions.length > 0 ? (
              <details className="text-sm">
                <summary className="cursor-pointer rounded-sm border border-rule px-2 py-1 text-ink-muted hover:text-ink">
                  Promote
                </summary>
                <ul className="mt-2 space-y-1">
                  {props.promotions.map((p) => (
                    <li key={p.href}>
                      <Link href={p.href} className="text-ink-muted hover:underline">
                        {p.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <section
        className="space-y-3 border-t border-rule px-5 py-4"
        aria-label={LAYER_LABELS.interpretation}
      >
        <Label>{LAYER_LABELS.interpretation}</Label>
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        {layer2}
      </section>
      {props.itemJudgment || onInterpretation ? (
        <section
          className="space-y-3 border-t border-rule px-5 py-4"
          aria-label={LAYER_LABELS.judgment}
        >
          <Label>{LAYER_LABELS.judgment}</Label>
          {props.itemJudgment ? (
            <div className="space-y-2">
              <p className="text-xs text-ink-subtle">On the item</p>
              {props.itemJudgment}
            </div>
          ) : null}
          {onInterpretation ? (
            <div className="space-y-2">
              <p className="text-xs text-ink-subtle">On the interpretation</p>
              {onInterpretation}
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
