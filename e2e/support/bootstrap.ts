import { spawnSync } from "node:child_process";

/**
 * Runs the documented local bootstrap command (`pnpm practice:bootstrap`,
 * V1-A D6), exactly as a developer establishing a fresh local installation
 * would. The site URL is the one the browser suite serves.
 */
export function practiceBootstrap(args: Record<string, string>) {
  const result = spawnSync(
    "pnpm",
    [
      "-s",
      "practice:bootstrap",
      ...Object.entries(args).flatMap(([name, value]) => [`--${name}`, value]),
    ],
    {
      encoding: "utf8",
      env: { ...process.env, NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000" },
    },
  );
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
}
