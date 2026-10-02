import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import {
  TEST_PASSWORD,
  acceptDialogs,
  acceptInvitation,
  closePages,
  newPage,
  signedInPage,
} from "./support/auth";
import { resetDatabase, runSql, sqlLiteral } from "./support/database";
import { localSupabase } from "./support/local-supabase";
import { clearMailbox, confirmationLink } from "./support/mailbox";

/**
 * Fresh installation (V1-A Gate A, browser run 1; plan §6.3).
 *
 * Covered today: G-1 (with the current documented bootstrap), part of G-2
 * (invite and accept), G-3, part of G-4 (create and publish), part of G-7
 * (create and publish a deliverable), and part of G-10. Deferred until their
 * workstreams land: the rest of G-2 (A), G-5 (D), G-6 and the rest of G-7
 * (B), G-8 (B), G-9 (C) and the rest of G-10 (E).
 *
 * Starts from an unseeded database (no organizations, no users) and follows
 * the product as far as it legitimately goes today. Where the current
 * product reaches a known V1-A dead end, the test asserts that boundary and
 * names the accepted workstream that will turn it into a golden-path step
 * (docs/product/V1_A_WORKFLOW_CLOSURE_PROPOSAL.md §4). Those assertions are
 * expected to fail when the workstream lands; that PR updates them.
 *
 * Nothing here weakens authorization. The only step outside the app is the
 * documented bootstrap (docs/database/bootstrap.md), performed exactly as an
 * owner would today until A7 replaces it.
 */

const ADMIN = { email: "admin@fresh.test", name: "First Administrator" };
const ARCHITECT = { email: "architect@fresh.test", first: "Ada", last: "Lovelace" };
const CLIENT_LEAD = { email: "lead@northwind.test", first: "Noor", last: "Haddad" };
const CLIENT_ORG = { name: "Northwind Civic Trust", slug: "northwind" };
const ENGAGEMENT = { title: "Northwind Regional Program", slug: "northwind-regional" };
const CAPABILITY = "Community stewardship";
const DELIVERABLE = "Northwind Executive Summary";

const engagementPath = `/internal/engagements/${ENGAGEMENT.slug}`;
const portalPath = `/portal/${ENGAGEMENT.slug}`;

/** Marks an assertion that pins a known V1-A dead end, and the workstream that closes it. */
function boundary(workstream: string, description: string) {
  test
    .info()
    .annotations.push({ type: "v1-a-boundary", description: `${workstream}: ${description}` });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  test.setTimeout(300_000);
  resetDatabase({ seed: false });
  await clearMailbox();
});

test.afterEach(closePages);

test("the database starts as a fresh installation", () => {
  expect(runSql("select count(*) from public.organizations")).toBe("0");
  expect(runSql("select count(*) from auth.users")).toBe("0");
});

test("G-1: the first administrator is bootstrapped and accepts the invitation", async ({
  page,
}) => {
  boundary(
    "A7",
    "the first user is created by a dashboard invitation plus SQL, as a System Administrator; A7 replaces this with one local command creating a Principal Architect",
  );
  // docs/database/bootstrap.md step 1: invite the first administrator.
  const { apiUrl, secretKey } = localSupabase();
  const admin = createClient(apiUrl, secretKey, { auth: { persistSession: false } });
  const { error } = await admin.auth.admin.inviteUserByEmail(ADMIN.email);
  expect(error).toBeNull();
  // Step 2: the documented SQL, unchanged.
  runSql(`
    with tplco as (
      insert into public.organizations (name, slug, type)
      values ('The Purple Lamb Company', 'tplco', 'tplco')
      returning id
    )
    insert into public.organization_members (organization_id, user_id, role, status)
    select tplco.id, p.id, 'system_administrator', 'invited'
    from tplco, public.profiles p
    where lower(p.email) = lower(${sqlLiteral(ADMIN.email)});
  `);
  // Step 3: the administrator accepts the email and sets a password.
  await acceptInvitation(page, await confirmationLink(ADMIN.email, /invit/i));
  await expect(page).toHaveURL(/\/internal/);
  await page.goto("/internal/settings");
  await page.getByLabel("First name").fill("First");
  await page.getByLabel("Last name").fill("Administrator");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
});

test("G-2 (part): the administrator invites an Architect, who accepts", async ({ browser }) => {
  const page = await signedInPage(browser, ADMIN.email, TEST_PASSWORD);
  await page.goto("/internal/organizations/tplco");
  await invite(page, ARCHITECT, "Architect");

  const invitee = await newPage(browser);
  await acceptInvitation(invitee, await confirmationLink(ARCHITECT.email, /invit/i));
  await expect(invitee).toHaveURL(/\/internal/);
});

test("G-3: a client organization, its lead and an engagement are set up and staffed", async ({
  browser,
}) => {
  const page = await signedInPage(browser, ADMIN.email, TEST_PASSWORD);

  await page.goto("/internal/organizations/new");
  await page.getByLabel("Organization name").fill(CLIENT_ORG.name);
  await page.getByLabel("Identifier").fill(CLIENT_ORG.slug);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(`/internal/organizations/${CLIENT_ORG.slug}`);
  await invite(page, CLIENT_LEAD, "Client Project Lead");

  const lead = await newPage(browser);
  await acceptInvitation(lead, await confirmationLink(CLIENT_LEAD.email, /invit/i));
  await expect(lead).toHaveURL(/\/portal/);

  await page.goto("/internal/engagements/new");
  await page.getByLabel("Client organization").selectOption({ label: CLIENT_ORG.name });
  await page.getByLabel("Engagement title").fill(ENGAGEMENT.title);
  await page.getByLabel("Identifier").fill(ENGAGEMENT.slug);
  await page.getByLabel("Project objective").fill("Architect the regional program.");
  await page.getByRole("button", { name: "Create engagement" }).click();
  await expect(page).toHaveURL(engagementPath);

  await addToTeam(page, `${ARCHITECT.first} ${ARCHITECT.last}`, "Architect");
  await addToTeam(page, `${CLIENT_LEAD.first} ${CLIENT_LEAD.last}`, "Client Project Lead");
});

test("the System Administrator holds no architectural authority and cannot grant it", async ({
  browser,
}) => {
  boundary(
    "A1, A2, A7",
    "a System Administrator cannot author architecture or grant authority; the first practice user becomes a Principal Architect who holds practice administration",
  );
  const page = await signedInPage(browser, ADMIN.email, TEST_PASSWORD);
  await page.goto(engagementPath);
  // The creator is staffed automatically with their practice role.
  await expect(
    page.getByRole("row", { name: new RegExp(`^${ADMIN.name} System Administrator`) }),
  ).toBeVisible();
  // The administrator manages the Architect's other capabilities…
  await expect(
    page.getByRole("combobox", {
      name: `View financials for ${ARCHITECT.first} ${ARCHITECT.last}`,
    }),
  ).toBeVisible();
  // …but no one on the engagement can be granted architecture authority by them.
  await expect(page.getByRole("combobox", { name: /^Edit architecture for / })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /^Publish architecture for / })).toHaveCount(0);
});

test("G-4 (part): the Architect creates a capability and publishes it", async ({ browser }) => {
  const page = await signedInPage(browser, ARCHITECT.email, TEST_PASSWORD);
  acceptDialogs(page);
  await page.goto(`${engagementPath}/architecture/capability?new=capability`);
  await page.locator("input[name=title]").fill(CAPABILITY);
  await page.locator("textarea[name=summary]").fill("Stewardship of shared civic assets.");
  await page
    .locator("select[name=clientVisibility]")
    .selectOption({ label: "Client-visible once published" });
  await page.getByRole("button", { name: "Create capability" }).click();

  await page.getByRole("link", { name: CAPABILITY }).first().click();
  await expect(page.getByRole("heading", { name: CAPABILITY })).toBeVisible();
  await page.getByRole("button", { name: "Publish v1" }).click();
  await page.locator("textarea[name=changeSummary]").fill("First publication.");
  await page.locator("form").getByRole("button", { name: "Publish v1" }).click();
  await expect(page.getByRole("button", { name: "Publish v2" })).toBeVisible();
});

test("the client lead sees the published capability in the portal", async ({ browser }) => {
  const page = await signedInPage(browser, CLIENT_LEAD.email, TEST_PASSWORD);
  await page.goto(`${portalPath}/architecture`);
  await page.getByRole("link", { name: CAPABILITY }).first().click();
  await expect(page.getByRole("heading", { name: CAPABILITY })).toBeVisible();
});

test("G-7 (part): a deliverable is created and published but cannot reach the client", async ({
  browser,
}) => {
  boundary(
    "B1",
    "a deliverable created in the UI stays internal: no control sets its client visibility",
  );
  const page = await signedInPage(browser, ARCHITECT.email, TEST_PASSWORD);
  acceptDialogs(page);
  await page.goto(`${engagementPath}/deliverables?new=1`);
  await expect(page.getByRole("button", { name: "Create deliverable" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: /client visibility/i })).toHaveCount(0);
  await page.locator("input[name=title]").fill(DELIVERABLE);
  await page.locator("textarea[name=summary]").fill("The executive summary.");
  await page.getByRole("button", { name: "Create deliverable" }).click();
  await page.getByRole("link", { name: DELIVERABLE }).first().click();
  await expect(page.getByRole("heading", { name: DELIVERABLE })).toBeVisible();
  const deliverableUrl = page.url();

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.locator("textarea[name=changeSummary]").fill("First publication.");
  await page.locator("form").getByRole("button", { name: "Publish v1" }).click();
  // Published: the next publication would be v2.
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.locator("form").getByRole("button", { name: "Publish v2" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: /client visibility/i })).toHaveCount(0);

  const client = await signedInPage(browser, CLIENT_LEAD.email, TEST_PASSWORD);
  await client.goto(portalPath);
  await expect(client.getByText("No deliverables yet")).toBeVisible();

  boundary("C1", "the generic element route returns a server error for a deliverable's id");
  // Control: the same route opens an architecture object.
  await page.goto(`${engagementPath}/architecture/capability`);
  await page.getByRole("link", { name: CAPABILITY }).first().click();
  await expect(page.getByRole("heading", { name: CAPABILITY, exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toMatch(/\/architecture\/elements\/[0-9a-f-]{36}$/);
  const deliverableId = new URL(deliverableUrl).pathname.split("/").pop()!;
  const response = await page.goto(`${engagementPath}/architecture/elements/${deliverableId}`);
  expect(response?.status()).toBe(500);
});

test("G-10 (part): the login page offers no password recovery", async ({ page }) => {
  boundary("E1", "there is no forgot-password flow");
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByText(/forgot/i)).toHaveCount(0);
});

async function invite(
  page: Page,
  person: { email: string; first: string; last: string },
  role: string,
) {
  await page.getByLabel("First name").fill(person.first);
  await page.getByLabel("Last name").fill(person.last);
  await page.getByLabel("Email", { exact: true }).fill(person.email);
  await page.getByLabel("Role").selectOption({ label: role });
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByRole("row", { name: new RegExp(person.email) })).toBeVisible();
}

async function addToTeam(page: Page, person: string, role: string) {
  const form = page.locator("form", { has: page.getByRole("button", { name: "Add to team" }) });
  await form.getByLabel("Person").selectOption({ label: `${person} — ${role}` });
  await form.getByRole("button", { name: "Add to team" }).click();
  await expect(page.getByText(`${person} added.`)).toBeVisible();
}
