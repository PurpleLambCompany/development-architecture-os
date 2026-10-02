import { AuthFrame } from "@/components/shell/auth-frame";
import { ButtonLink } from "@/components/ui/button";

/**
 * A stale or mistyped internal link (C2/C3): a calm page, not the framework
 * default, with a way back into the workspace.
 */
export default function InternalNotFound() {
  return (
    <AuthFrame title="Not found">
      <p className="text-sm text-ink-muted">
        This record does not exist, or you do not have access to it.
      </p>
      <div className="mt-6">
        <ButtonLink href="/internal" variant="secondary">
          Return to workspace
        </ButtonLink>
      </div>
    </AuthFrame>
  );
}
