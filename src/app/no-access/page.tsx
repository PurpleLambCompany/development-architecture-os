import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import { getViewer } from "@/lib/auth/viewer";
import { Button } from "@/components/ui/button";
import { AuthFrame } from "@/components/shell/auth-frame";

export const metadata = { title: "No access" };

export default async function NoAccessPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.side) redirect("/");

  return (
    <AuthFrame title="Access not yet available">
      <p className="text-sm text-ink-muted">
        You are signed in as <span className="text-ink">{viewer.email}</span>, but this account is
        not currently attached to an active organization. If you expected access, please contact
        your TPLCo engagement lead.
      </p>
      <form action={signOut} className="mt-6">
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
    </AuthFrame>
  );
}
