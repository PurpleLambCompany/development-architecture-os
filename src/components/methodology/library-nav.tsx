import Link from "next/link";
import { cn } from "@/lib/utils";

export type LibrarySection = "assets" | "releases" | "contexts";

/** Tabs across the Method Library. */
export function LibraryNav({ current }: { current: LibrarySection }) {
  const tabs: { key: LibrarySection; href: string; label: string }[] = [
    { key: "assets", href: "/internal/method-library", label: "Assets" },
    { key: "releases", href: "/internal/method-library/releases", label: "DAM releases" },
    { key: "contexts", href: "/internal/method-library/contexts", label: "Development Contexts" },
  ];
  return (
    <nav className="-mt-4 flex gap-x-1 border-b border-rule text-sm" aria-label="Method Library">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2",
            tab.key === current
              ? "border-accent text-ink"
              : "border-transparent text-ink-muted hover:text-ink",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
