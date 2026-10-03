import { AuthFrame } from "@/components/shell/auth-frame";
import { requireViewer } from "@/lib/auth/viewer";
import { SetPasswordForm } from "./set-password-form";

export const metadata = { title: "Set your password" };

export default async function SetPasswordPage() {
  const viewer = await requireViewer();

  return (
    <AuthFrame title="Set your password">
      <p className="mb-6 text-sm text-ink-muted">
        Choose a password for <span className="text-ink">{viewer.email}</span>. This replaces any
        previous password. You can also sign in with an emailed link at any time.
      </p>
      <SetPasswordForm />
    </AuthFrame>
  );
}
