import Link from "next/link";
import { AuthFrame } from "@/components/shell/auth-frame";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthFrame title="Forgot your password?">
      <p className="mb-6 text-sm text-ink-muted">
        Enter the email address on your account and, if it has access, we will send a link to choose
        a new password.
      </p>
      <ForgotPasswordForm />
      <p className="mt-6 border-t border-rule pt-5 text-xs text-ink-subtle">
        <Link href="/login" className="underline hover:text-ink-muted">
          Back to sign in
        </Link>
      </p>
    </AuthFrame>
  );
}
