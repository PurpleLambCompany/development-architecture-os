#!/usr/bin/env node
// =============================================================================
// DSA OS — establish the practice on a fresh LOCAL installation (V1-A, D6, D7).
//
//   pnpm practice:bootstrap --email you@example.com --first-name Ada --last-name Lovelace
//
// Creates the practice (TPLCo) organization and invites its first user as a
// Principal Architect, who therefore holds practice administration and
// architectural authority by role default, with nothing granted to
// themselves. The first user accepts the emailed invitation and sets a
// password; everything after that happens in the app.
//
// LOCAL AND PRE-PRODUCTION ONLY (D6). It talks only to the local Supabase
// stack reported by `supabase status`, and refuses to run against any other
// host or once a practice exists. It is not the production bootstrap
// mechanism; V1-B makes that decision separately. See
// docs/database/bootstrap.md.
// =============================================================================
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const USAGE = `Usage: pnpm practice:bootstrap --email <email> --first-name <name> --last-name <name>
                               [--practice-name <name>] [--practice-slug <identifier>]`;

function refuse(message) {
  console.error(`practice:bootstrap: ${message}`);
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    "first-name": { type: "string" },
    "last-name": { type: "string" },
    "practice-name": { type: "string", default: "The Purple Lamb Company" },
    "practice-slug": { type: "string", default: "tplco" },
    help: { type: "boolean", default: false },
  },
});
if (values.help) {
  console.log(USAGE);
  process.exit(0);
}
const email = values.email?.trim().toLowerCase();
const firstName = values["first-name"]?.trim();
const lastName = values["last-name"]?.trim();
const practiceName = values["practice-name"].trim();
const practiceSlug = values["practice-slug"].trim();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  refuse(`an --email is required.\n${USAGE}`);
if (!firstName || !lastName) refuse(`--first-name and --last-name are required.\n${USAGE}`);
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(practiceSlug)) {
  refuse("--practice-slug may contain only lowercase letters, numbers and hyphens.");
}

// The local stack, and only the local stack.
let status;
try {
  const output = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  status = JSON.parse(output.slice(output.indexOf("{")));
} catch {
  refuse("local Supabase is not running. Start it with `pnpm db:start` first.");
}
const { API_URL: apiUrl, SECRET_KEY: secretKey, MAILPIT_URL: mailpitUrl } = status;
if (!apiUrl || !secretKey) refuse("`supabase status` did not report the API URL and secret key.");
const apiHost = new URL(apiUrl).hostname;
if (apiHost !== "127.0.0.1" && apiHost !== "localhost") {
  refuse(`refusing to run against ${apiHost}: this command is for a local installation only.`);
}

// The invitation must return to the site URL the auth server uses, or the
// link is consumed and the person lands on the sign-in page.
const config = readFileSync("supabase/config.toml", "utf8");
const siteUrl = config.match(/^\s*site_url\s*=\s*"([^"]+)"/m)?.[1];
if (!siteUrl) refuse("supabase/config.toml does not set [auth] site_url.");
// The app's own site URL, as Next.js resolves it: the environment first,
// then .env.local.
const appSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (existsSync(".env.local")
    ? readFileSync(".env.local", "utf8").match(/^NEXT_PUBLIC_SITE_URL=(.*)$/m)?.[1]
    : undefined);
if (appSiteUrl && appSiteUrl.trim().replace(/\/$/, "") !== siteUrl.replace(/\/$/, "")) {
  refuse(
    `the app's NEXT_PUBLIC_SITE_URL (${appSiteUrl.trim()}) differs from the auth site_url ` +
      `(${siteUrl}). Make them the same, then run this again.`,
  );
}

const admin = createClient(apiUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { count, error: countError } = await admin
  .from("organizations")
  .select("id", { count: "exact", head: true })
  .eq("type", "tplco");
if (countError) refuse(`could not read the installation: ${countError.message}`);
if (count) {
  refuse("a practice already exists. This command only establishes a fresh installation.");
}
const { data: existing } = await admin
  .from("profiles")
  .select("id")
  .eq("email", email)
  .maybeSingle();
if (existing) refuse(`an account for ${email} already exists.`);

const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
  data: { first_name: firstName, last_name: lastName },
  redirectTo: `${siteUrl.replace(/\/$/, "")}/auth/confirm`,
});
if (inviteError || !invited.user)
  refuse(`the invitation could not be sent: ${inviteError?.message}`);

const { data: practice, error: practiceError } = await admin
  .from("organizations")
  .insert({ name: practiceName, slug: practiceSlug, type: "tplco" })
  .select("id")
  .single();
if (practiceError) {
  await admin.auth.admin.deleteUser(invited.user.id);
  refuse(`the practice could not be created: ${practiceError.message}`);
}

const { error: memberError } = await admin.from("organization_members").insert({
  organization_id: practice.id,
  user_id: invited.user.id,
  role: "principal_architect",
  status: "invited",
});
if (memberError) {
  await admin.from("organizations").delete().eq("id", practice.id);
  await admin.auth.admin.deleteUser(invited.user.id);
  refuse(`the first membership could not be created: ${memberError.message}`);
}

console.log(`Created ${practiceName} and invited ${firstName} ${lastName} <${email}> as its Principal Architect.
Open the invitation${mailpitUrl ? ` in the local mail catcher (${mailpitUrl})` : ""}, set a password, and continue in the app at ${siteUrl}.`);
