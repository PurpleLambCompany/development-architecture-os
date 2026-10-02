import { expect } from "@playwright/test";
import { localSupabase } from "./local-supabase";

/**
 * The local mail catcher (Mailpit), where the local auth server delivers
 * invitation and sign-in emails. Tests follow the links people would click.
 */
type Summary = { ID: string; Subject: string; To: { Address: string }[] };

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${localSupabase().mailpitUrl}/api/v1${path}`, init);
  if (!response.ok) throw new Error(`Mailpit ${path} returned ${response.status}`);
  return response;
}

export async function clearMailbox() {
  await api("/messages", { method: "DELETE" });
}

async function messagesTo(email: string): Promise<Summary[]> {
  const query = encodeURIComponent(`to:"${email}"`);
  const body = (await (await api(`/search?query=${query}`)).json()) as { messages: Summary[] };
  return body.messages;
}

/**
 * Waits for an email to `email` whose subject matches, and returns the
 * confirmation link it carries.
 */
export async function confirmationLink(email: string, subject: RegExp): Promise<string> {
  let found: Summary | undefined;
  await expect
    .poll(
      async () => {
        found = (await messagesTo(email)).find((m) => subject.test(m.Subject));
        return found !== undefined;
      },
      { message: `an email to ${email} matching ${subject}`, timeout: 20_000 },
    )
    .toBe(true);
  const message = (await (await api(`/message/${found!.ID}`)).json()) as { HTML: string };
  const link = [...message.HTML.matchAll(/href="([^"]+)"/g)]
    .map((match) => match[1].replaceAll("&amp;", "&"))
    .find((href) => href.includes("/auth/confirm"));
  if (!link) throw new Error(`The email to ${email} has no confirmation link`);
  return link;
}
