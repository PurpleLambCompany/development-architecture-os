import { expect, test, type Page } from "@playwright/test";
import {
  TEST_PASSWORD,
  acceptDialogs,
  acceptInvitation,
  closePages,
  newPage,
  signedInPage,
} from "./support/auth";
import { practiceBootstrap } from "./support/bootstrap";
import { resetDatabase, runSql } from "./support/database";
import { clearMailbox, confirmationLink } from "./support/mailbox";

/**
 * Fresh installation (V1-A Gate A, browser run 1; plan §6.3).
 *
 * Covered: G-1 and G-2 (Workstream A, Increment 2), G-3, part of G-4
 * (create and publish), part of G-7 (create and publish a deliverable), and
 * part of G-10. Deferred until their workstreams land: G-4's evidence and
 * relationships and G-5 (D), G-6 and the rest of G-7 (B), G-8 (B), G-9 (C)
 * and the rest of G-10 (E).
 *
 * Starts from an unseeded database (no organizations, no users). The only
 * step outside the app is the documented local bootstrap command (D6); from
 * then on everything happens in the browser, with no SQL. Where the product
 * still reaches a known V1-A dead end, the test asserts that boundary and
 * names the accepted workstream that will turn it into a golden-path step
 * (docs/product/V1_A_WORKFLOW_CLOSURE_PROPOSAL.md §4). Those assertions are
 * expected to fail when the workstream lands; that PR updates them.
 *
 * Authorization is proven in pgTAP (60_practice_administration); this suite
 * proves the workflows are usable and that people meet the refusals where
 * the product says they will.
 */

const PRINCIPAL = { email: "principal@fresh.test", first: "Ada", last: "Lovelace" };
const ARCHITECT = { email: "architect@fresh.test", first: "Grace", last: "Hopper" };
const RESEARCHER = { email: "research@fresh.test", first: "Rosalind", last: "Franklin" };
const PROJECT_ADMIN = { email: "projects@fresh.test", first: "Katherine", last: "Johnson" };
const SYSADMIN = { email: "ops@fresh.test", first: "Alan", last: "Turing" };
const WITHDRAWN = { email: "withdrawn@fresh.test", first: "Pat", last: "Pending" };
const CLIENT_LEAD = { email: "lead@northwind.test", first: "Noor", last: "Haddad" };
const PRACTICE = { name: "Lovelace Development Architecture", slug: "lovelace" };
const CLIENT_ORG = { name: "Northwind Civic Trust", slug: "northwind" };
const ENGAGEMENT = { title: "Northwind Regional Program", slug: "northwind-regional" };
const CAPABILITY = "Community stewardship";
const DELIVERABLE = "Northwind Executive Summary";

const practicePath = `/internal/organizations/${PRACTICE.slug}`;
const engagementPath = `/internal/engagements/${ENGAGEMENT.slug}`;
const portalPath = `/portal/${ENGAGEMENT.slug}`;
const fullName = (person: { first: string; last: string }) => `${person.first} ${person.last}`;

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

test("G-1: one command establishes the practice; its Principal Architect accepts and runs it in the app", async ({
  page,
}) => {
  const first = practiceBootstrap({
    email: PRINCIPAL.email,
    "first-name": PRINCIPAL.first,
    "last-name": PRINCIPAL.last,
  });
  expect(first.output).toContain("as its Principal Architect");
  expect(first.ok).toBe(true);

  const second = practiceBootstrap({
    email: "someone.else@fresh.test",
    "first-name": "Someone",
    "last-name": "Else",
  });
  expect(second.ok).toBe(false);
  expect(second.output).toContain("a practice already exists");

  await acceptInvitation(page, await confirmationLink(PRINCIPAL.email, /invit/i));
  await expect(page).toHaveURL(/\/internal/);

  // Named by the command, with no setup step of their own.
  await page.goto("/internal/settings");
  await expect(page.getByLabel("First name")).toHaveValue(PRINCIPAL.first);
  await expect(page.getByLabel("Last name")).toHaveValue(PRINCIPAL.last);

  // A6: the practice organization is edited in the app.
  await page.goto("/internal/organizations/tplco");
  await page.getByLabel("Organization name").fill(PRACTICE.name);
  await page.getByLabel("Identifier").fill(PRACTICE.slug);
  await expect(page.getByLabel("Status")).toHaveCount(0);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(practicePath);
  await expect(page.getByRole("heading", { name: PRACTICE.name })).toBeVisible();
  await expect(memberRow(page, PRINCIPAL)).toContainText("Principal Architect");
  await expect(memberRow(page, PRINCIPAL)).toContainText("You");
});

test("G-2: the Principal Architect invites colleagues, who accept", async ({ browser }) => {
  const page = await signedInPage(browser, PRINCIPAL.email, TEST_PASSWORD);
  await page.goto(practicePath);
  // A Principal Architect may give every practice role.
  await expect(page.getByLabel("Role", { exact: true }).locator("option")).toHaveText([
    "System Administrator",
    "Principal Architect",
    "Architect",
    "Researcher",
    "Project Administrator",
    "Finance Administrator",
  ]);
  await invite(page, ARCHITECT, "Architect");
  await invite(page, RESEARCHER, "Researcher");
  await invite(page, PROJECT_ADMIN, "Project Administrator");
  await invite(page, SYSADMIN, "System Administrator");
  await invite(page, WITHDRAWN, "Finance Administrator");

  for (const person of [ARCHITECT, PROJECT_ADMIN, SYSADMIN]) {
    const invitee = await newPage(browser);
    await acceptInvitation(invitee, await confirmationLink(person.email, /invit/i));
    await expect(invitee).toHaveURL(/\/internal/);
  }
  await page.reload();
  for (const person of [ARCHITECT, PROJECT_ADMIN, SYSADMIN]) {
    await expect(memberRow(page, person)).toContainText("active");
  }
});

test("G-2: an invitation is re-sent and another is revoked", async ({ browser }) => {
  const page = await signedInPage(browser, PRINCIPAL.email, TEST_PASSWORD);
  acceptDialogs(page);
  await page.goto(practicePath);

  // Resend: a new email arrives, its link works, and the old link is spent.
  const firstLink = await confirmationLink(RESEARCHER.email, /invit/i);
  await memberRow(page, RESEARCHER).getByRole("button", { name: "Resend invitation" }).click();
  await expect(memberRow(page, RESEARCHER)).toContainText(
    `A new invitation was sent to ${fullName(RESEARCHER)}.`,
  );
  const secondLink = await confirmationLink(RESEARCHER.email, /invit/i, { count: 2 });
  expect(secondLink).not.toBe(firstLink);
  const stale = await newPage(browser);
  await stale.goto(firstLink);
  await expect(stale).toHaveURL(/\/login\?error=link/);
  const researcher = await newPage(browser);
  await acceptInvitation(researcher, secondLink);
  await expect(researcher).toHaveURL(/\/internal/);

  // Revoke: the row goes, and the link no longer signs anyone in.
  const withdrawnLink = await confirmationLink(WITHDRAWN.email, /invit/i);
  await memberRow(page, WITHDRAWN).getByRole("button", { name: "Revoke invitation" }).click();
  await expect(memberRow(page, WITHDRAWN)).toHaveCount(0);
  const revoked = await newPage(browser);
  await revoked.goto(withdrawnLink);
  await expect(revoked).toHaveURL(/\/login\?error=link/);
});

test("G-3: a client organization, its lead and an engagement are set up and staffed in practice roles", async ({
  browser,
}) => {
  const page = await signedInPage(browser, PRINCIPAL.email, TEST_PASSWORD);

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

  // An internal person's engagement role is shown, not chosen (D3).
  await addToTeam(page, fullName(ARCHITECT), "Architect");
  await addToTeam(page, fullName(RESEARCHER), "Researcher");
  await addToTeam(page, fullName(SYSADMIN), "System Administrator");
  await addToTeam(page, fullName(CLIENT_LEAD), "Client Project Lead", "Client Project Lead");
  await expect(teamRow(page, RESEARCHER)).toContainText("Researcher");
});

test("A2, A3: the Principal Architect gives a colleague architectural authority, and their engagement role follows", async ({
  browser,
}) => {
  const page = await signedInPage(browser, PRINCIPAL.email, TEST_PASSWORD);
  const dialogs: string[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    void dialog.accept();
  });
  await page.goto(practicePath);
  const row = memberRow(page, RESEARCHER);
  await row.getByLabel(`Role for ${fullName(RESEARCHER)}`).selectOption({ label: "Architect" });
  await row.getByRole("button", { name: "Change role" }).click();
  await expect(row).toContainText(`${fullName(RESEARCHER)} is now Architect.`);
  expect(dialogs[0]).toContain(`from Researcher to Architect`);
  expect(dialogs[0]).toContain("Publish architecture");

  await page.goto(engagementPath);
  await expect(teamRow(page, RESEARCHER)).toContainText("Architect");
  // On the engagement, a Principal Architect governs others' authority.
  await expect(
    page.getByRole("combobox", { name: `Publish architecture for ${fullName(ARCHITECT)}` }),
  ).toBeVisible();
});

test("A1: practice administration is delegated without architectural authority", async ({
  browser,
}) => {
  const page = await signedInPage(browser, PRINCIPAL.email, TEST_PASSWORD);
  await page.goto("/internal/settings/practice");
  const row = page.getByRole("row", { name: new RegExp(fullName(PROJECT_ADMIN)) });
  const administerCell = row.getByRole("cell").nth(4);
  await expect(administerCell).toContainText("No");
  await administerCell.getByRole("button", { name: "Grant" }).click();
  await administerCell.getByLabel("Reason").fill("Runs onboarding for the practice.");
  await administerCell.getByRole("button", { name: "Grant" }).click();
  await expect(administerCell).toContainText("granted by override");

  const delegate = await signedInPage(browser, PROJECT_ADMIN.email, TEST_PASSWORD);
  await delegate.goto(practicePath);
  await expect(delegate.getByRole("heading", { name: "Invite a person" })).toBeVisible();
  await expect(delegate.getByLabel("Role", { exact: true }).locator("option")).toHaveText([
    "System Administrator",
    "Project Administrator",
    "Finance Administrator",
  ]);
});

test("A2: a System Administrator administers the practice but cannot create architectural authority", async ({
  browser,
}) => {
  const page = await signedInPage(browser, SYSADMIN.email, TEST_PASSWORD);
  await page.goto(practicePath);
  await expect(
    page.getByText("Only a Principal Architect can invite or appoint Principal Architects"),
  ).toBeVisible();
  await expect(page.getByLabel("Role", { exact: true }).locator("option")).toHaveText([
    "System Administrator",
    "Project Administrator",
    "Finance Administrator",
  ]);
  // On a colleague's row, the authority-bearing roles are not available.
  const roles = memberRow(page, PROJECT_ADMIN).getByLabel(`Role for ${fullName(PROJECT_ADMIN)}`);
  for (const role of ["Principal Architect", "Architect", "Researcher"]) {
    await expect(roles.locator("option", { hasText: new RegExp(`^${role}$`) })).toHaveCount(0);
  }

  // On an engagement, no one's architecture authority is theirs to change.
  await page.goto(engagementPath);
  await expect(teamRow(page, SYSADMIN)).toContainText("System Administrator");
  await expect(
    page.getByRole("combobox", { name: `View financials for ${fullName(ARCHITECT)}` }),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: /^Edit architecture for / })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /^Publish architecture for / })).toHaveCount(0);
});

test("D5: nobody changes their own role or status, and the last Principal Architect remains", async ({
  browser,
}) => {
  const principal = await signedInPage(browser, PRINCIPAL.email, TEST_PASSWORD);
  await principal.goto(practicePath);
  await expect(memberRow(principal, PRINCIPAL).getByRole("button")).toHaveCount(0);
  await principal.goto("/internal/settings/practice");
  await expect(
    principal.getByRole("row", { name: new RegExp(fullName(PRINCIPAL)) }).getByRole("button"),
  ).toHaveCount(0);

  const page = await signedInPage(browser, SYSADMIN.email, TEST_PASSWORD);
  acceptDialogs(page);
  await page.goto(practicePath);
  await expect(memberRow(page, SYSADMIN).getByRole("button")).toHaveCount(0);

  const row = memberRow(page, PRINCIPAL);
  await row.getByRole("button", { name: "Suspend" }).click();
  await expect(row).toContainText("At least one active Principal Architect must remain");
  await row
    .getByLabel(`Role for ${fullName(PRINCIPAL)}`)
    .selectOption({ label: "Project Administrator" });
  await row.getByRole("button", { name: "Change role" }).click();
  await expect(row).toContainText("At least one active Principal Architect must remain");
  await page.reload();
  await expect(memberRow(page, PRINCIPAL)).toContainText("Principal Architect");
  await expect(memberRow(page, PRINCIPAL)).toContainText("active");
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

/** The organization member row for a person. */
function memberRow(page: Page, person: { email: string }) {
  return page.getByRole("row", { name: new RegExp(person.email.replaceAll(".", "\\.")) });
}

/** A person's row in an engagement's internal team panel. */
function teamRow(page: Page, person: { first: string; last: string }) {
  return page
    .locator("section", { has: page.getByRole("heading", { name: "Internal team" }) })
    .getByRole("row", { name: new RegExp(`^${fullName(person)}`) });
}

async function invite(
  page: Page,
  person: { email: string; first: string; last: string },
  role: string,
) {
  await page.getByLabel("First name").fill(person.first);
  await page.getByLabel("Last name").fill(person.last);
  await page.getByLabel("Email", { exact: true }).fill(person.email);
  await page.getByLabel("Role", { exact: true }).selectOption({ label: role });
  await page.getByRole("button", { name: "Send invitation", exact: true }).click();
  await expect(memberRow(page, person)).toBeVisible();
}

/**
 * Adds a person to the engagement team. An internal person's role is their
 * practice role, shown read-only; a client person's role is chosen.
 */
async function addToTeam(page: Page, person: string, role: string, clientRole?: string) {
  const form = page.locator("form", { has: page.getByRole("button", { name: "Add to team" }) });
  await form.getByLabel("Person").selectOption({ label: `${person} — ${role}` });
  if (clientRole) {
    await form.getByLabel("Engagement role").selectOption({ label: clientRole });
  } else {
    await expect(form.getByLabel("Engagement role")).toHaveValue(role);
    await expect(form.getByLabel("Engagement role")).not.toBeEditable();
  }
  await form.getByRole("button", { name: "Add to team" }).click();
  await expect(page.getByText(`${person} added.`)).toBeVisible();
}
