import "server-only";
import { z } from "zod";

/** Server-only secrets. Importing this from a client component fails the build. */
const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
});

export function getServerEnv() {
  return serverEnvSchema.parse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
}
