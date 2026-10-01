"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Escape closes the drawer (to its URL without the drawer), and the page behind does not scroll. */
export function DrawerKeys({ closeHref }: { closeHref: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(closeHref, { scroll: false });
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [closeHref, router]);
  return null;
}
