import { z } from "zod";
import { ENGAGEMENT_CAPABILITIES } from "./catalog";

/** default removes the override so the role default applies again. */
export const CAPABILITY_SETTINGS = ["default", "grant", "revoke"] as const;
export type CapabilitySetting = (typeof CAPABILITY_SETTINGS)[number];

export const setCapabilitySchema = z.object({
  memberId: z.uuid(),
  capability: z.enum(ENGAGEMENT_CAPABILITIES),
  setting: z.enum(CAPABILITY_SETTINGS),
  reason: z.string().trim().max(500).default(""),
});
