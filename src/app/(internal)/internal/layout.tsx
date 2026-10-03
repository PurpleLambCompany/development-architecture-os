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
              <NavigationGroups hasFinance={hasFinance} />
            </Suspense>
          </nav>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative flex items-center justify-between gap-3 border-b border-rule bg-surface px-4 py-3 sm:px-8">
          {/*
            F6: every nav destination reachable at 390px. Rather than a
            second, hand-maintained flat link list (which is exactly how
            Intelligence, Reviews, Implementation, Method Library and
            Settings went unreachable below md in the first place), this
            disclosure renders the same NavigationGroups the desktop
            sidebar uses, so the two can never drift apart again. A plain
            <details>/<summary> needs no client script and is keyboard-
            and screen-reader-accessible by default.
          */}
          <details className="group md:hidden">
            <summary className="cursor-pointer list-none rounded-sm border border-rule-strong px-3 py-1.5 text-sm text-ink-muted marker:content-none">
              Menu
            </summary>
            <nav
              className="absolute inset-x-0 top-full z-10 max-h-[70vh] overflow-y-auto border-b border-rule bg-surface px-4 py-4 shadow-md"
              aria-label="Internal (menu)"
            >
              <NavigationGroups hasFinance={hasFinance} />
            </nav>
          </details>
          <span className="hidden md:block" />
          <UserMenu
            name={viewer.displayName}
            role={viewer.role}
            organizationName={viewer.organizationName}
          />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

/** The navigation structure, shared by the desktop sidebar and the mobile menu (F6) so they cannot drift apart. */
function NavigationGroups({ hasFinance }: { hasFinance: boolean }) {
  return (
    <>
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
        <NavLink href="/internal/implementation">Implementation</NavLink>
      </NavGroup>
      <NavGroup label="Practice">
        <NavLink href="/internal/method-library">Method Library</NavLink>
      </NavGroup>
      <NavGroup label="Later phases">
        <NavPlaceholder>Portfolio</NavPlaceholder>
      </NavGroup>
      <NavGroup>
        <NavLink href="/internal/settings">Settings</NavLink>
      </NavGroup>
    </>
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
