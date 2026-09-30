"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateOrganizationMember } from "@/domain/memberships/actions";
import type { AppRole } from "@/domain/roles/roles";
import { Button } from "@/components/ui/button";

/** Suspend or restore a membership. Suspension removes all access immediately. */
export function MemberStatusButton({
  memberId,
  role,
  status,
}: {
  memberId: string;
  role: AppRole;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const suspend = status === "active";

  if (status !== "active" && status !== "suspended") return null;

  return (
    <Button
      type="button"
      size="sm"
      variant={suspend ? "danger" : "secondary"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await updateOrganizationMember(memberId, {
            role,
            status: suspend ? "suspended" : "active",
          });
          if (!result.ok) window.alert(result.error);
          router.refresh();
        })
      }
    >
      {suspend ? "Suspend" : "Restore"}
    </Button>
  );
}
