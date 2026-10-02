"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setClientVisibility } from "@/domain/architecture/actions";
import type { ClientVisibility } from "@/domain/architecture/catalog";
import { Button } from "@/components/ui/button";

/**
 * Client visibility for a deliverable, review or implementation initiative
 * (V1-A B1). Offered only to holders of publish_architecture; the database
 * enforces the same rule. Clients see only published versions, and only
 * while the record is client-visible.
 */
export function ClientVisibilityControl({
  elementId,
  visibility,
  published,
  noun,
}: {
  elementId: string;
  visibility: ClientVisibility;
  published: boolean;
  /** "deliverable", "review" or "initiative", for the explanation. */
  noun: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next: ClientVisibility = visibility === "client" ? "internal" : "client";
  const explanation =
    visibility === "client"
      ? published
        ? `The client sees this ${noun}'s published versions now.`
        : `The client will see this ${noun} once it is published.`
      : `The client cannot see this ${noun}.`;
  const confirmText =
    next === "client"
      ? published
        ? `Show this ${noun} to the client? They see its published versions at once, and each later publication.`
        : `Show this ${noun} to the client once it is published?`
      : `Hide this ${noun} from the client? They lose access to it, and its files, at once.`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-ink-muted">{explanation}</span>
        <Button
          type="button"
          size="sm"
          variant={next === "client" ? "primary" : "secondary"}
          disabled={pending}
          onClick={() => {
            if (!window.confirm(confirmText)) return;
            setError(null);
            startTransition(async () => {
              const result = await setClientVisibility(elementId, { visibility: next });
              if (!result.ok) setError(result.error);
              router.refresh();
            });
          }}
        >
          {pending ? "Working…" : next === "client" ? "Show to client" : "Make internal"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}
