import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const fieldControlClass =
  "block w-full rounded-sm border border-rule-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle focus-visible:border-accent focus-visible:outline-none aria-[invalid=true]:border-negative disabled:bg-surface-muted";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldControlClass, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldControlClass, "min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldControlClass, "h-10 pr-8", className)} {...props} />;
}
