import type { ReactNode } from "react";

/** Centered frame for sign-in and account pages. */
export function AuthFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <p className="mb-10 text-center text-xs font-medium tracking-[0.18em] text-ink-subtle uppercase">
          Development Systems Architecture OS
        </p>
        <div className="rounded-sm border border-rule bg-surface px-8 py-9">
          <h1 className="mb-6 font-serif text-2xl text-ink">{title}</h1>
          {children}
        </div>
        <p className="mt-8 text-center text-xs text-ink-subtle">The Purple Lamb Company</p>
      </div>
    </main>
  );
}
