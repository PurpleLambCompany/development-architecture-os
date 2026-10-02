import { AuthFrame } from "@/components/shell/auth-frame";
import { ButtonLink } from "@/components/ui/button";

/**
 * A stale or mistyped portal link (C2/C3): a calm page, not the framework
 * default, with a way back into the portal. Never distinguishes a record
 * that does not exist from one the client is not authorized to see.
 */
export default function PortalNotFound() {
  return (
    <AuthFrame title="Not found">
      <p className="text-sm text-ink-muted">
        This page does not exist, or you do not have access to it.
      </p>
      <div className="mt-6">
        <ButtonLink href="/portal" variant="secondary">
          Return to your engagements
        </ButtonLink>
      </div>
    </AuthFrame>
  );
}
