import { signOut } from "@/lib/auth/actions";
import { ROLE_LABELS, type AppRole } from "@/domain/roles/roles";

export function UserMenu({
  name,
  role,
  organizationName,
}: {
  name: string;
  role: AppRole;
  organizationName: string | null;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="text-right leading-tight">
        <p className="text-sm text-ink">{name}</p>
        <p className="text-xs text-ink-subtle">
          {ROLE_LABELS[role]}
          {organizationName ? ` · ${organizationName}` : ""}
        </p>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-sm border border-rule-strong px-2.5 py-1 text-xs text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
