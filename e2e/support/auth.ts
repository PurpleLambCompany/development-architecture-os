import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

/** Every account a browser test creates uses this password (local only). */
export const TEST_PASSWORD = "browser-suite-password-1";

/** The password the seed gives every demo account (`supabase/seed.sql`). */
export const SEED_PASSWORD = "dsa-demo-password";

/** Signs in through the login page with an email and password. */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

const openContexts: BrowserContext[] = [];

/** A page in a new, signed-out browser context. Close it with `closePages`. */
export async function newPage(browser: Browser) {
  const context = await browser.newContext();
  openContexts.push(context);
  return context.newPage();
}

/** A page in a new browser context signed in as `email`. Close it with `closePages`. */
export async function signedInPage(browser: Browser, email: string, password: string) {
  const page = await newPage(browser);
  await signIn(page, email, password);
  return page;
}

/** Closes the contexts `newPage` and `signedInPage` opened; call after each test. */
export async function closePages() {
  await Promise.all(openContexts.splice(0).map((context) => context.close()));
}

/**
 * Follows an invitation link from the mailbox, chooses a password on the
 * set-password page, and continues into the app, as an invitee would.
 */
export async function acceptInvitation(page: Page, link: string, password = TEST_PASSWORD) {
  await page.goto(link);
  await expect(page).toHaveURL(/\/account\/set-password/);
  await page.getByLabel("New password").fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Save password and continue" }).click();
  await expect(page).not.toHaveURL(/\/account\/set-password|\/login/);
}

/** Accepts the confirm() dialogs some governed actions ask for. */
export function acceptDialogs(page: Page) {
  page.on("dialog", (dialog) => void dialog.accept());
}
