import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireClient, requireInternal } from "@/lib/auth/viewer";
import { getMyEngagementCapabilities } from "@/domain/capabilities/queries";
import { getEngagementBySlug } from "@/domain/engagements/queries";

/**
 * The engagement and the viewer's architecture authority, for internal pages.
 * The flags only decide which controls to offer: every write is checked
 * again by the database against the same capabilities.
 */
export const getInternalArchitectureContext = cache(async (slug: string) => {
  const viewer = await requireInternal();
  const engagement = await getEngagementBySlug(slug);
  if (!engagement) notFound();
  const capabilities = await getMyEngagementCapabilities(engagement.id);
  return {
    viewer,
    engagement,
    canEdit: capabilities.has("edit_architecture"),
    canPublish: capabilities.has("publish_architecture"),
  };
});

export type InternalArchitectureContext = Awaited<
  ReturnType<typeof getInternalArchitectureContext>
>;

/** The engagement and the client viewer's architecture capabilities. */
export const getClientArchitectureContext = cache(async (slug: string) => {
  const viewer = await requireClient();
  const engagement = await getEngagementBySlug(slug);
  if (!engagement) notFound();
  const capabilities = await getMyEngagementCapabilities(engagement.id);
  return {
    viewer,
    engagement,
    capabilities,
    canView: capabilities.has("view_architecture"),
    canRespond: capabilities.has("view_architecture") && capabilities.has("approve_architecture"),
    seesBilling: capabilities.has("view_financials"),
  };
});

/** Names of the engagement's members by user id, for "recorded by" lines. */
export function memberNames(engagement: InternalArchitectureContext["engagement"]) {
  const names = new Map<string, string>();
  for (const m of engagement.engagement_members) {
    const p = m.profiles;
    if (!p) continue;
    names.set(m.user_id, [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email);
  }
  return (id: string | null | undefined) => (id ? (names.get(id) ?? "TPLCo") : "—");
}
