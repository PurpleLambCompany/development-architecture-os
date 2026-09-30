import Link from "next/link";
import { requireClient } from "@/lib/auth/viewer";
import { UserMenu } from "@/components/shell/user-menu";

/**
 * Client environment. Only people with an active membership of an active
 * client organization pass requireClient(); RLS independently limits every
 * query to engagements they are assigned to. A person may belong to more
 * than one client organization (for example an advisor), so their role is
 * shown per engagement rather than in the header when that is the case.
 */
export default async function ClientLayout({ children }: LayoutProps<"/portal">) {
  const viewer = await requireClient();

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
          <Link href="/portal" className="block">
            <p className="font-serif text-lg leading-tight text-ink">
              {viewer.memberships.length === 1
                ? viewer.memberships[0]!.organizationName
                : "Your engagements"}
            </p>
            <p className="text-[11px] tracking-[0.14em] text-ink-subtle uppercase">
              Development Architecture Environment
            </p>
          </Link>
          <UserMenu
            name={viewer.displayName}
            role={viewer.memberships.length === 1 ? viewer.memberships[0]!.role : null}
            organizationName={null}
          />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-8 py-10">{children}</main>
      <footer className="mx-auto max-w-6xl px-8 pb-10 text-xs text-ink-subtle">
        Delivered by The Purple Lamb Company · Development Architecture Method™
      </footer>
    </div>
  );
}
