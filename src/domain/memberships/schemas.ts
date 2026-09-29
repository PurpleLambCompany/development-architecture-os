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

export const assignEngagementMemberSchema = z.object({
  userId: z.uuid("Choose a person"),
  role: z.enum(ALL_ROLES, "Choose a role"),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type AssignEngagementMemberInput = z.infer<typeof assignEngagementMemberSchema>;
