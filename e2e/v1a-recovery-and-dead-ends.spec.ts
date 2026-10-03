import { expect, test } from "@playwright/test";
import {
  SEED_PASSWORD,
  TEST_PASSWORD,
  acceptDialogs,
  closePages,
  signedInPage,
} from "./support/auth";
import { resetDatabase, runSql } from "./support/database";
import { clearMailbox, confirmationLink } from "./support/mailbox";

/**
 * V1-A Increment 6 (Workstreams D/E/F): password recovery, evidence
 * cleanup, successor/supersession, relationship publication, and the
 * responsive navigation fix (F6).
 *
 * Invitation resend/revoke (A5) is not re-covered here: it is unchanged
 * from Increment 2 and already exercised end-to-end by
 * fresh-install.spec.ts (resend, revoke, and an expired/reused link all
 * through the real UI and mailbox). This suite covers only what Increment
 * 6 actually added or changed.
 */

const MERIDIAN_SLUG = "meridian-innovation-district";
const MERIDIAN_ID = "e0000000-0000-4000-8000-000000000001";
const ARCHITECT = "architect@tplco.test";
const RECOVERY_EMAIL = "researcher@tplco.test";

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  test.setTimeout(300_000);
  resetDatabase({ seed: true });
});

test.afterEach(closePages);

test("forgot password: a recovery email leads to a new password that signs in", async ({
  browser,
}) => {
  await clearMailbox();
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password/);
  await page.getByLabel("Email").fill(RECOVERY_EMAIL);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/password reset link is on its way/)).toBeVisible();

  const link = await confirmationLink(RECOVERY_EMAIL, /reset/i);
  await page.goto(link);
  await expect(page).toHaveURL(/\/account\/set-password/);
  await page.getByLabel("New password").fill(TEST_PASSWORD);
  await page.getByLabel("Confirm password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Save password and continue" }).click();
  await expect(page).not.toHaveURL(/\/account\/set-password|\/login/);

  // Signed in from the recovery flow (visiting /login while already signed
  // in redirects home, so sign out first); signing back in with the same
  // new password, and confirming the old seed password no longer works,
  // proves the password actually changed.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Email").fill(RECOVERY_EMAIL);
  await page.getByLabel("Password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("The email or password is incorrect.")).toBeVisible();

  await page.getByLabel("Email").fill(RECOVERY_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
});

test("a forgot-password request for an address with no account gives the same response", async ({
  browser,
}) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("nobody-has-this-address@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/password reset link is on its way/)).toBeVisible();
});

test("a signed-in user changes their password from the account menu", async ({ browser }) => {
  const page = await signedInPage(browser, "contributor@meridian.test", SEED_PASSWORD);
  await page.getByRole("link", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/account\/set-password/);
  await page.getByLabel("New password").fill(TEST_PASSWORD);
  await page.getByLabel("Confirm password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Save password and continue" }).click();
  await expect(page).not.toHaveURL(/\/account\/set-password|\/login/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email").fill("contributor@meridian.test");
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
});

test("every nav destination is reachable at 390px (F6)", async ({ browser }) => {
  const page = await signedInPage(browser, ARCHITECT, SEED_PASSWORD);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/internal");
  // Before Increment 6, only 5 flat links were offered below md; these were
  // the ones completely unreachable, per the Increment 6 reconciliation.
  await expect(page.getByRole("link", { name: "Intelligence" })).toHaveCount(0);
  await page.getByText("Menu", { exact: true }).click();
  const menu = page.getByRole("navigation", { name: "Internal (menu)" });
  await expect(menu).toBeVisible();
  for (const name of ["Intelligence", "Reviews", "Implementation", "Method Library", "Settings"]) {
    await expect(menu.getByRole("link", { name })).toBeVisible();
  }
  await menu.getByRole("link", { name: "Method Library" }).click();
  await expect(page).toHaveURL(/\/internal\/method-library/);
  await expect(page.getByRole("main")).toBeVisible();
});

test("evidence deletion: uncited succeeds, cited is refused with a clear message", async ({
  browser,
}) => {
  runSql(`
    insert into public.evidence_sources (id, engagement_id, title, source_type, provenance, client_visibility)
    values ('f9000000-0000-4000-8000-000000000001', '${MERIDIAN_ID}', 'Uncited test source', 'document', 'architect_judgment', 'internal')
  `);

  const page = await signedInPage(browser, ARCHITECT, SEED_PASSWORD);
  acceptDialogs(page);
  await page.goto(`/internal/engagements/${MERIDIAN_SLUG}/evidence`);

  // Cited: a seeded source with existing citations offers no delete control.
  const citedPanel = page.locator("section", {
    has: page.getByRole("heading", { name: "Regional Commercial Real Estate Outlook 2026" }),
  });
  await expect(citedPanel.getByText(/Cited by \d+ — cannot be deleted/)).toBeVisible();
  await expect(citedPanel.getByRole("button", { name: "Delete source" })).toHaveCount(0);

  // Uncited: the delete control is offered and succeeds.
  const uncitedPanel = page.locator("section", {
    has: page.getByRole("heading", { name: "Uncited test source" }),
  });
  await uncitedPanel.getByRole("button", { name: "Delete source" }).click();
  await expect(page.getByRole("heading", { name: "Uncited test source" })).toHaveCount(0);
  expect(
    runSql(
      `select count(*) from public.evidence_sources where id = 'f9000000-0000-4000-8000-000000000001'`,
    ),
  ).toBe("0");
});

test("create successor composes a new draft and marks the original superseded; the superseded original can then be retired", async ({
  browser,
}) => {
  runSql(`
    with ins as (
      insert into public.architecture_elements (id, engagement_id, kind, title, provenance)
      values ('f9000000-0000-4000-8000-000000000002', '${MERIDIAN_ID}', 'object', 'Successor-ready capability', 'architect_judgment')
      returning id
    )
    insert into public.architecture_objects (element_id, object_type) select id, 'capability' from ins
  `);

  const page = await signedInPage(browser, ARCHITECT, SEED_PASSWORD);
  acceptDialogs(page);
  await page.goto(
    `/internal/engagements/${MERIDIAN_SLUG}/architecture/elements/f9000000-0000-4000-8000-000000000002`,
  );
  await page.getByRole("button", { name: "Publish v1" }).click();
  await page.locator("textarea[name=changeSummary]").fill("First publication.");
  await page.locator("form").getByRole("button", { name: "Publish v1" }).click();
  await expect(page.getByText("Published", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Create successor" }).click();
  await page
    .locator("form")
    .filter({ hasText: "Reason this successor is needed" })
    .locator("textarea[name=reason]")
    .fill("Closing the acquisition gap identified after the readiness review.");
  await page
    .locator("form")
    .filter({ hasText: "Reason this successor is needed" })
    .getByRole("button", { name: "Create successor" })
    .click();

  await expect(page.getByText("Superseded", { exact: true }).first()).toBeVisible();

  // The retire control, hidden for a superseded element before this
  // increment (ADR-0075), is now offered and withdraws it from the client.
  await page.getByRole("button", { name: "Retire" }).click();
  await page.locator("form").getByLabel("Reason").fill("Superseded; withdrawing the original.");
  await page.locator("form").getByRole("button", { name: "Retire" }).click();
  await expect(page.getByText("Retired", { exact: true }).first()).toBeVisible();

  expect(
    runSql(
      `select lifecycle from public.architecture_elements where id = 'f9000000-0000-4000-8000-000000000002'`,
    ),
  ).toBe("retired");
});

test("a relationship between two already-published elements can be published through the UI", async ({
  browser,
}) => {
  runSql(`
    with ins as (
      insert into public.architecture_elements (id, engagement_id, kind, title, provenance)
      values
        ('f9000000-0000-4000-8000-000000000003', '${MERIDIAN_ID}', 'object', 'Relationship end A', 'architect_judgment'),
        ('f9000000-0000-4000-8000-000000000004', '${MERIDIAN_ID}', 'object', 'Relationship end B', 'architect_judgment')
      returning id
    )
    insert into public.architecture_objects (element_id, object_type) select id, 'capability' from ins
  `);

  const page = await signedInPage(browser, ARCHITECT, SEED_PASSWORD);
  acceptDialogs(page);

  for (const id of [
    "f9000000-0000-4000-8000-000000000003",
    "f9000000-0000-4000-8000-000000000004",
  ]) {
    await page.goto(`/internal/engagements/${MERIDIAN_SLUG}/architecture/elements/${id}`);
    await page.getByRole("button", { name: "Publish v1" }).click();
    await page.locator("textarea[name=changeSummary]").fill("First publication.");
    await page.locator("form").getByRole("button", { name: "Publish v1" }).click();
    await expect(page.getByText("Published", { exact: true }).first()).toBeVisible();
  }

  await page.goto(
    `/internal/engagements/${MERIDIAN_SLUG}/architecture/elements/f9000000-0000-4000-8000-000000000003`,
  );
  await page.getByRole("button", { name: "Add relationship" }).click();
  await page.getByLabel("Find target").fill("Relationship end B");
  const targetOption = page.locator("#relationship-target option", {
    hasText: "Relationship end B",
  });
  await expect(targetOption).toHaveCount(1);
  const targetValue = await targetOption.getAttribute("value");
  await page.locator("#relationship-target").selectOption(targetValue!);
  await page.locator("form").getByRole("button", { name: "Add relationship" }).click();

  await expect(page.getByText("Pending publication")).toBeVisible();
  await page.getByRole("button", { name: "Publish relationship" }).click();
  await expect(page.getByText("Pending publication")).toHaveCount(0);
  expect(
    runSql(
      `select (published_at is not null) from public.architecture_relationships
       where source_element_id = 'f9000000-0000-4000-8000-000000000003'
         and target_element_id = 'f9000000-0000-4000-8000-000000000004'`,
    ),
  ).toBe("t");
});
