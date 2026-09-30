import "server-only";
import { z } from "zod";
import { DEFAULT_BUSINESS_TIME_ZONE, isValidTimeZone } from "@/domain/finance/business-date";

/** Server-only secrets. Importing this from a client component fails the build. */
const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
});

export function getServerEnv() {
  return serverEnvSchema.parse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
}

/** IANA zone for business dates (due, past due, today). Never CST/CDT. ADR-0010. */
const businessTimeZoneSchema = z
  .string()
  .default(DEFAULT_BUSINESS_TIME_ZONE)
  .refine(isValidTimeZone, "BUSINESS_TIME_ZONE must be an IANA time zone, such as America/Chicago");

export function getBusinessTimeZone(): string {
  return businessTimeZoneSchema.parse(process.env.BUSINESS_TIME_ZONE || undefined);
}
