import Link from "next/link";
import { Suspense } from "react";
import { requireInternal } from "@/lib/auth/viewer";
import { getFinanceDirectory } from "@/domain/finance/queries";
import { NavLink, NavPlaceholder } from "@/components/shell/nav-link";
import { UserMenu } from "@/components/shell/user-menu";

/**
 * Internal TPLCo workspace. Only active TPLCo members get past
 * requireInternal(); the database independently refuses client users.
 * Navigation follows spec §28. Areas from later phases are shown, muted,
 * so the structure of the platform is visible from the start.
 */
export default async function InternalLayout({ children }: LayoutProps<"/internal">) {
  const viewer = await requireInternal();
  // Finance appears only for people with financial visibility somewhere.
  const hasFinance = (await getFinanceDirectory()).length > 0;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-rule bg-surface md:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="border-b border-rule px-5 py-5">
            <Link href="/internal" className="block">
              <p className="font-serif text-lg leading-tight text-ink">DSA OS</p>
              <p className="text-[11px] tracking-[0.14em] text-ink-subtle uppercase">
                TPLCo Workspace
              </p>
            </Link>
          </div>
          <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5" aria-label="Internal">
            <Suspense>
              <NavGroup>
                <NavLink href="/internal" exact>
                  Dashboard
                </NavLink>
              </NavGroup>
              <NavGroup label="Clients">
                <NavLink href="/internal/organizations">Organizations</NavLink>
                <NavPlaceholder>Contacts</NavPlaceholder>
              </NavGroup>
              <NavGroup label="Engagements">
                <NavLink href="/internal/engagements?view=active">Active</NavLink>
                <NavLink href="/internal/engagements?view=upcoming">Upcoming</NavLink>
                <NavLink href="/internal/engagements?view=completed">Completed</NavLink>
              </NavGroup>
              {hasFinance ? (
                <NavGroup label="Finance">
                  <NavLink href="/internal/finance">Portfolio</NavLink>
                </NavGroup>
              ) : null}
              <NavGroup label="Architecture">
                <NavLink href="/internal/architecture">Architecture</NavLink>
                <NavLink href="/internal/intelligence">Intelligence</NavLink>
                <NavLink href="/internal/reviews">Reviews</NavLink>
              </NavGroup>
              <NavGroup label="Later phases">
                <NavPlaceholder>Deliverables</NavPlaceholder>
                <NavPlaceholder>Method Library</NavPlaceholder>
                <NavPlaceholder>Portfolio</NavPlaceholder>
              </NavGroup>
              <NavGroup>
                <NavLink href="/internal/settings">Settings</NavLink>
              </NavGroup>
            </Suspense>
          </nav>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-rule bg-surface px-8 py-3">
          <nav className="flex gap-4 text-sm md:hidden" aria-label="Internal (compact)">
            <Link href="/internal">Dashboard</Link>
            <Link href="/internal/organizations">Organizations</Link>
            <Link href="/internal/engagements">Engagements</Link>
            <Link href="/internal/architecture">Architecture</Link>
            {hasFinance ? <Link href="/internal/finance">Finance</Link> : null}
          </nav>
          <span className="hidden md:block" />
          <UserMenu
            name={viewer.displayName}
            role={viewer.role}
            organizationName={viewer.organizationName}
          />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-8 py-10">{children}</main>
      </div>
    </div>
  );
}

function NavGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div>
      {label ? (
        <p className="mb-1 px-3 text-[11px] font-medium tracking-[0.12em] text-ink-subtle uppercase">
          {label}
        </p>
      ) : null}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
