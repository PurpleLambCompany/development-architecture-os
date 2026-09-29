import { z } from "zod";

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .trim()
  .min(2, "At least 2 characters")
  .max(80, "At most 80 characters")
  .regex(SLUG_PATTERN, "Lowercase letters, numbers and single hyphens only");

/** "Meridian Development Authority" -> "meridian-development-authority" */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}
