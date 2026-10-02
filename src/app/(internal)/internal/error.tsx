"use client";

import { useEffect } from "react";
import { AuthFrame } from "@/components/shell/auth-frame";
import { Button, ButtonLink } from "@/components/ui/button";

/**
 * An unexpected error anywhere in the internal workspace (C3): a calm,
 * branded page instead of the framework's own error screen. Never shows the
 * error's own message, so nothing internal leaks to the page.
 */
export default function InternalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Internal workspace error", error);
  }, [error]);

  return (
    <AuthFrame title="Something went wrong">
      <p className="text-sm text-ink-muted">
        This page could not be prepared. It has been logged
        {error.digest ? ` (reference ${error.digest})` : ""}.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => reset()}>
          Try again
        </Button>
        <ButtonLink href="/internal" variant="ghost">
          Return to workspace
        </ButtonLink>
      </div>
    </AuthFrame>
  );
}
