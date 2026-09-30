import { AuthFrame } from "@/components/shell/auth-frame";
import { FormMessage } from "@/components/ui/field";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;

  return (
    <AuthFrame title="Sign in">
      {error === "link" ? (
        <div className="mb-5">
          <FormMessage tone="error">
            That link is invalid or has expired. Request a new one below.
          </FormMessage>
        </div>
      ) : null}
      <LoginForm />
      <p className="mt-6 border-t border-rule pt-5 text-xs text-ink-subtle">
        Access is by invitation only. If you need access, contact your TPLCo engagement lead.
      </p>
    </AuthFrame>
  );
}
