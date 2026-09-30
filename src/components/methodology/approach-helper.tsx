"use client";

import { useEffect, useRef, useState } from "react";
import { internalTitlesIn, type ApproachGuidance } from "@/domain/methodology/approach";

/**
 * Authoring help inside a statement form (§17.2): offers each approved
 * name for insertion, and warns while the text names an internal-only asset.
 * It never blocks: naming a method to a client is the architect's authored act.
 */
export function ApproachHelper({ guidance }: { guidance: ApproachGuidance }) {
  const ref = useRef<HTMLDivElement>(null);
  const [named, setNamed] = useState<string[]>([]);

  const body = () =>
    ref.current?.closest("form")?.querySelector<HTMLTextAreaElement>('textarea[name="body"]') ??
    null;

  useEffect(() => {
    const textarea = body();
    if (!textarea) return;
    const check = () => setNamed(internalTitlesIn(textarea.value, guidance.internalTitles));
    check();
    textarea.addEventListener("input", check);
    return () => textarea.removeEventListener("input", check);
  }, [guidance.internalTitles]);

  const insert = (name: string) => {
    const textarea = body();
    if (!textarea) return;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    const next = textarea.value.slice(0, start) + name + textarea.value.slice(end);
    // Set through the native setter so the form library sees the change.
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(
      textarea,
      next,
    );
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
    textarea.setSelectionRange(start + name.length, start + name.length);
  };

  if (guidance.approved.length === 0 && guidance.internalTitles.length === 0) return null;
  return (
    <div ref={ref} className="space-y-2 text-sm">
      {guidance.approved.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-subtle">Approved names for an approach statement:</span>
          {guidance.approved.map((a) => (
            <button
              key={a.name}
              type="button"
              onClick={() => insert(a.name)}
              className="rounded-sm border border-rule px-2 py-0.5 text-xs text-ink hover:bg-surface-muted"
              title={`Insert the approved name of ${a.assetTitle}`}
            >
              Insert “{a.name}”
            </button>
          ))}
        </div>
      ) : null}
      {named.length > 0 ? (
        <p role="status" className="text-xs text-attention">
          This text names {named.join(", ")}, which is internal only. If the statement is
          client-visible, a client will read it.
        </p>
      ) : null}
    </div>
  );
}
