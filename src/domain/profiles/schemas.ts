import { z } from "zod";

export const profileNameSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(100),
  lastName: z.string().trim().min(1, "Required").max(100),
});

export const passwordSchema = z
  .object({
    password: z.string().min(12, "At least 12 characters").max(128),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });
