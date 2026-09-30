"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** Sidebar link that marks itself current by path (and optional ?view=). */
export function NavLink({
  href,
  exact = false,
  children,
  nested = false,
}: {
  href: string;
  exact?: boolean;
  nested?: boolean;
  children: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [path, query] = href.split("?");
  const view = new URLSearchParams(query).get("view");

  const pathMatches = exact
    ? pathname === path
    : pathname === path || pathname.startsWith(`${path}/`);
  const current = pathMatches && (!view || searchParams.get("view") === view);

  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "block rounded-sm py-1.5 text-sm transition-colors",
        nested ? "pl-6" : "pl-3",
        current
          ? "bg-accent-soft font-medium text-accent"
          : "text-ink-muted hover:bg-rule/40 hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

/** A navigation entry for a capability that arrives in a later phase. */
export function NavPlaceholder({
  children,
  nested = false,
}: {
  children: string;
  nested?: boolean;
}) {
  return (
    <span
      className={cn(
        "block cursor-default py-1.5 text-sm text-ink-subtle/70",
        nested ? "pl-6" : "pl-3",
      )}
      title="Not yet available"
    >
      {children}
    </span>
  );
}
