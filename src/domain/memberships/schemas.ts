import { z } from "zod";
import { CLIENT_ROLES, INTERNAL_ROLES } from "@/domain/roles/roles";

const ALL_ROLES = [...INTERNAL_ROLES, ...CLIENT_ROLES] as const;

export const inviteMemberSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase().max(320),
  firstName: z.string().trim().min(1, "Required").max(100),
  lastName: z.string().trim().min(1, "Required").max(100),
  role: z.enum(ALL_ROLES, "Choose a role"),
});

export const updateMemberSchema = z.object({
  role: z.enum(ALL_ROLES),
  status: z.enum(["active", "suspended"]),
});

/**
 * An internal person's engagement role is their practice role (D3), so it
 * is never chosen; a client person's role is chosen from the client roles.
 */
export const assignEngagementMemberSchema = z.object({
  userId: z.uuid("Choose a person"),
  role: z.enum(CLIENT_ROLES, "Choose a role").optional(),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type AssignEngagementMemberInput = z.infer<typeof assignEngagementMemberSchema>;
