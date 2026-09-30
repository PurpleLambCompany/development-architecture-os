import { AuthFrame } from "@/components/shell/auth-frame";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <AuthFrame title="Not found">
      <p className="text-sm text-ink-muted">
        This page does not exist, or you do not have access to it.
      </p>
      <div className="mt-6">
        <ButtonLink href="/" variant="secondary">
          Return home
        </ButtonLink>
      </div>
    </AuthFrame>
  );
}
