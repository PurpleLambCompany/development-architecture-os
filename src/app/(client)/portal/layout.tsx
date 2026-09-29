import Link from "next/link";
import { requireClient } from "@/lib/auth/viewer";
import { UserMenu } from "@/components/shell/user-menu";

/**
 * Client environment. Only active members of an active client
 * organization pass requireClient(); RLS independently limits every
 * query to engagements the client user is assigned to.
 */
export default async function ClientLayout({ children }: LayoutProps<"/portal">) {
  const viewer = await requireClient();

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
          <Link href="/portal" className="block">
            <p className="font-serif text-lg leading-tight text-ink">{viewer.organizationName}</p>
            <p className="text-[11px] tracking-[0.14em] text-ink-subtle uppercase">
              Development Architecture Environment
            </p>
          </Link>
          <UserMenu name={viewer.displayName} role={viewer.role} organizationName={null} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-8 py-10">{children}</main>
      <footer className="mx-auto max-w-6xl px-8 pb-10 text-xs text-ink-subtle">
        Delivered by The Purple Lamb Company · Development Architecture Method™
      </footer>
    </div>
  );
}
