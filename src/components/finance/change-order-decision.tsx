"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveChangeOrder, rejectChangeOrder } from "@/domain/finance/actions";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";

/**
 * Approve or decline a change order in the portal. Approval changes the
 * contract value and is final; the database records who decided and when.
 */
export function ChangeOrderDecision({
  changeOrderId,
  amountLabel,
}: {
  changeOrderId: string;
  amountLabel: string;
}) {
  const router = useRouter();
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const act = (work: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await work();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });

  return (
    <div className="space-y-3">
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {declining ? (
        <div className="space-y-3">
          <Field label="Reason for declining" htmlFor={`decline-${changeOrderId}`}>
            <Textarea
              id={`decline-${changeOrderId}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="danger"
              disabled={pending || note.trim() === ""}
              onClick={() => act(() => rejectChangeOrder(changeOrderId, { note }))}
            >
              Decline change order
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDeclining(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => {
              if (
                !window.confirm(
                  `Approve this change order? The contract value changes by ${amountLabel}. This is final.`,
                )
              )
                return;
              act(() => approveChangeOrder(changeOrderId));
            }}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => setDeclining(true)}
          >
            Decline
          </Button>
        </div>
      )}
    </div>
  );
}
