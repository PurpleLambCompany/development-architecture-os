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
 * (create and publish), G-6 and G-7 (Workstream B, Increment 3), the
 * client-visibility part of G-8, G-9 (Workstream C, Increment 4), and part
 * of G-10. Deferred until their workstreams land: G-4's evidence and
 * relationships and G-5 (D), G-8's invoice and payment (F), and the rest of
 * G-10 (E).
 *
 * Starts from an unseeded database (no organizations, no users). The only
 * step outside the app is the documented local bootstrap command (D6); from
 * then on everything happens in the browser, with no SQL. Where the product
 * still reaches a known V1-A dead end, the test asserts that boundary and
 * names the accepted workstream that will turn it into a golden-path step
 * (docs/product/V1_A_WORKFLOW_CLOSURE_PROPOSAL.md §4). Those assertions are
 * expected to fail when the workstream lands; that PR updates them.
 *
 * Authorization is proven in pgTAP (60_practice_administration,
 * 62_client_records_and_files); this suite
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
const REVIEW = "Northwind Scope Review";
const INITIATIVE = "Stewardship council";
const CONTRIBUTOR = { email: "contributor@northwind.test", first: "Omar", last: "Reyes" };
const OTHER_LEAD = { email: "lead@southbank.test", first: "Lena", last: "Ortiz" };
const OTHER_ORG = { name: "Southbank Housing Trust", slug: "southbank" };
const OTHER_ENGAGEMENT = { title: "Southbank Housing Program", slug: "southbank-housing" };

const practicePath = `/internal/organizations/${PRACTICE.slug}`;
const engagementPath = `/internal/engagements/${ENGAGEMENT.slug}`;
const portalPath = `/portal/${ENGAGEMENT.slug}`;
const otherEngagementPath = `/internal/engagements/${OTHER_ENGAGEMENT.slug}`;
const fullName = (person: { first: string; last: string }) => `${person.first} ${person.last}`;
/** Set by G-7 and G-6/G-8, read by G-9. */
let deliverableId = "";
let reviewId = "";
let initiativeId = "";

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

test("B: a Client Contributor and another client's lead are set up", async ({ browser }) => {
  const page = await signedInPage(browser, PRINCIPAL.email, TEST_PASSWORD);
  await page.goto(`/internal/organizations/${CLIENT_ORG.slug}`);
  await invite(page, CONTRIBUTOR, "Client Contributor");
  const contributor = await newPage(browser);
  await acceptInvitation(contributor, await confirmationLink(CONTRIBUTOR.email, /invit/i));
  await expect(contributor).toHaveURL(/\/portal/);
  await page.goto(engagementPath);
  // Staffed without contributor areas: they see only what their areas reach.
  await addToTeam(page, fullName(CONTRIBUTOR), "Client Contributor", "Client Contributor");

  await page.goto("/internal/organizations/new");
  await page.getByLabel("Organization name").fill(OTHER_ORG.name);
  await page.getByLabel("Identifier").fill(OTHER_ORG.slug);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(`/internal/organizations/${OTHER_ORG.slug}`);
  await invite(page, OTHER_LEAD, "Client Project Lead");
  const other = await newPage(browser);
  await acceptInvitation(other, await confirmationLink(OTHER_LEAD.email, /invit/i));
  await expect(other).toHaveURL(/\/portal/);
  await page.goto("/internal/engagements/new");
  await page.getByLabel("Client organization").selectOption({ label: OTHER_ORG.name });
  await page.getByLabel("Engagement title").fill(OTHER_ENGAGEMENT.title);
  await page.getByLabel("Identifier").fill(OTHER_ENGAGEMENT.slug);
  await page.getByLabel("Project objective").fill("Another client's program.");
  await page.getByRole("button", { name: "Create engagement" }).click();
  await addToTeam(page, fullName(OTHER_LEAD), "Client Project Lead", "Client Project Lead");
});

test("G-7: a deliverable is published with a file and reaches the client only once shown, keeping its version 1 file after republication", async ({
  browser,
}) => {
  const page = await signedInPage(browser, ARCHITECT.email, TEST_PASSWORD);
  acceptDialogs(page);
  await page.goto(`${engagementPath}/deliverables?new=1`);
  await page.locator("input[name=title]").fill(DELIVERABLE);
  await page.locator("textarea[name=summary]").fill("The executive summary.");
  await page.getByRole("button", { name: "Create deliverable" }).click();
  await page.getByRole("link", { name: DELIVERABLE }).first().click();
  await expect(page.getByRole("heading", { name: DELIVERABLE })).toBeVisible();
  deliverableId = new URL(page.url()).pathname.split("/").pop()!;
  await publish(page, 1, "First publication.");
  const v1 = await attachFile(page, "summary-v1.pdf", "Version 1 of the summary.");
  const v1Files = page.getByRole("region", { name: "Version 1 files" });
  await expect(v1Files.getByRole("heading")).toHaveText("Version 1 · current");
  await expect(page.getByText("The client cannot see this deliverable.")).toBeVisible();

  // Published but not shown: no client can find or fetch it.
  const lead = await signedInPage(browser, CLIENT_LEAD.email, TEST_PASSWORD);
  await lead.goto(`${portalPath}/deliverables`);
  await expect(lead.getByText("No deliverables yet")).toBeVisible();
  expect((await lead.request.get(`/files/${v1.id}`)).status()).toBe(404);
  expect((await lead.goto(`${portalPath}/architecture/${deliverableId}`))?.status()).toBe(404);

  // Shown deliberately, by someone who can publish architecture.
  await page.getByRole("button", { name: "Show to client" }).click();
  await expect(
    page.getByText("The client sees this deliverable's published versions now."),
  ).toBeVisible();

  await lead.goto(portalPath);
  await lead.getByRole("link", { name: DELIVERABLE }).click();
  await expect(lead).toHaveURL(`${portalPath}/deliverables`);
  const shown = lead.getByRole("article", { name: DELIVERABLE });
  await expect(shown).toContainText("The executive summary.");
  await expect(shown.getByRole("link", { name: "summary-v1.pdf" })).toBeVisible();
  const download = await lead.request.get(`/files/${v1.id}`);
  expect(download.status()).toBe(200);
  expect(await download.text()).toBe("Version 1 of the summary.");

  // Area-limited, and outside the engagement: refused at the database.
  const contributor = await signedInPage(browser, CONTRIBUTOR.email, TEST_PASSWORD);
  await contributor.goto(`${portalPath}/deliverables`);
  await expect(contributor.getByText("No deliverables yet")).toBeVisible();
  expect((await contributor.request.get(`/files/${v1.id}`)).status()).toBe(404);
  const other = await signedInPage(browser, OTHER_LEAD.email, TEST_PASSWORD);
  expect((await other.request.get(`/files/${v1.id}`)).status()).toBe(404);
  expect((await other.goto(`${portalPath}/deliverables`))?.status()).toBe(404);

  // D9: republishing keeps version 1's file with version 1.
  await page.goto(`${engagementPath}/deliverables/${deliverableId}`);
  await publish(page, 2, "Corrected the summary.");
  const v2 = await attachFile(page, "summary-v2.pdf", "Version 2 of the summary.");
  await expect(
    page.getByRole("region", { name: "Version 2 files" }).getByRole("heading"),
  ).toHaveText("Version 2 · current");
  await expect(v1Files.getByRole("heading")).toHaveText("Version 1");
  await expect(v1Files.getByRole("link", { name: "summary-v1.pdf" })).toBeVisible();

  await lead.goto(`${portalPath}/deliverables`);
  await expect(shown).toContainText("Version 2, published");
  await expect(
    shown
      .getByRole("region", { name: "Version 2 files" })
      .getByRole("link", { name: "summary-v2.pdf" }),
  ).toBeVisible();
  await expect(
    shown
      .getByRole("region", { name: "Version 1 files" })
      .getByRole("link", { name: "summary-v1.pdf" }),
  ).toBeVisible();
  expect(await (await lead.request.get(`/files/${v1.id}`)).text()).toBe(
    "Version 1 of the summary.",
  );
  expect(await (await lead.request.get(`/files/${v2.id}`)).text()).toBe(
    "Version 2 of the summary.",
  );
  expect((await other.request.get(`/files/${v2.id}`)).status()).toBe(404);
});

test("G-6: a review is scheduled, corrected, held, published and shown to the client", async ({
  browser,
}) => {
  const page = await signedInPage(browser, ARCHITECT.email, TEST_PASSWORD);
  acceptDialogs(page);
  await page.goto(`${engagementPath}/reviews`);
  await page.getByRole("button", { name: "Schedule a review" }).click();
  await page.locator("input[name=title]").fill(REVIEW);
  await page.locator("input[name=scheduledFor]").fill("2026-11-02T15:00");
  await page.locator("textarea[name=summary]").fill("Agenda to follow.");
  await page.getByRole("button", { name: "Schedule review" }).click();
  await page.getByRole("link", { name: REVIEW }).first().click();
  await expect(page.getByRole("heading", { name: REVIEW })).toBeVisible();
  reviewId = new URL(page.url()).pathname.split("/").pop()!;

  // B2: the review's own fields are corrected on its page.
  await page.getByRole("button", { name: "Edit review fields" }).click();
  const edit = page.locator("form", { has: page.locator("input[name=scheduledFor]") });
  await edit.locator("textarea[name=summary]").fill("Confirm the regional program's scope.");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Confirm the regional program's scope.")).toBeVisible();

  await page.getByRole("button", { name: "Hold review" }).click();
  await page.locator("textarea[name=summary]").fill("Scope confirmed.");
  await page.getByRole("button", { name: "Record as held" }).click();
  await expect(page.getByText("Scope confirmed.")).toBeVisible();
  await publish(page, 1, "The held review.");

  const lead = await signedInPage(browser, CLIENT_LEAD.email, TEST_PASSWORD);
  await lead.goto(`${portalPath}/reviews`);
  await expect(lead.getByText("No reviews published yet")).toBeVisible();

  await page.getByRole("button", { name: "Show to client" }).click();
  await expect(
    page.getByText("The client sees this review's published versions now."),
  ).toBeVisible();
  await lead.reload();
  await expect(lead.getByText(REVIEW, { exact: true })).toBeVisible();
  await expect(lead.getByText("Scope confirmed.")).toBeVisible();

  const contributor = await signedInPage(browser, CONTRIBUTOR.email, TEST_PASSWORD);
  await contributor.goto(`${portalPath}/reviews`);
  await expect(contributor.getByText("No reviews published yet")).toBeVisible();
});

test("G-8 (part): an initiative is published and shown to the client", async ({ browser }) => {
  const page = await signedInPage(browser, ARCHITECT.email, TEST_PASSWORD);
  acceptDialogs(page);
  await page.goto(`${engagementPath}/implementation?new=1`);
  await page.locator("input[name=title]").fill(INITIATIVE);
  await page.getByLabel(new RegExp(CAPABILITY)).check();
  await page.locator("textarea[name=summary]").fill("Stand up the stewardship council.");
  await page.getByRole("button", { name: "Create initiative" }).click();
  await page.getByRole("link", { name: INITIATIVE }).first().click();
  await expect(page.getByRole("heading", { name: INITIATIVE })).toBeVisible();
  initiativeId = new URL(page.url()).pathname.split("/").pop()!;
  await publish(page, 1, "First publication.");

  const lead = await signedInPage(browser, CLIENT_LEAD.email, TEST_PASSWORD);
  await lead.goto(`${portalPath}/implementation`);
  await expect(lead.getByText(INITIATIVE, { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Show to client" }).click();
  await expect(
    page.getByText("The client sees this initiative's published versions now."),
  ).toBeVisible();
  await lead.reload();
  await expect(lead.getByText(INITIATIVE, { exact: true })).toBeVisible();

  const contributor = await signedInPage(browser, CONTRIBUTOR.email, TEST_PASSWORD);
  await contributor.goto(`${portalPath}/implementation`);
  await expect(contributor.getByText(INITIATIVE, { exact: true })).toHaveCount(0);
});

test("G-9: every record kind reaches its canonical page, invalid and foreign ids fail safely, and links stay inside their engagement", async ({
  browser,
}) => {
  const page = await signedInPage(browser, ARCHITECT.email, TEST_PASSWORD);

  // Ordinary architecture-element route: unaffected control.
  await page.goto(`${engagementPath}/architecture/capability`);
  await page.getByRole("link", { name: CAPABILITY }).first().click();
  await expect(page.getByRole("heading", { name: CAPABILITY, exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toMatch(/\/architecture\/elements\/[0-9a-f-]{36}$/);

  // C1: the generic route redirects each Phase 5 kind to its own page instead
  // of failing, and a version link on that page carries the version along.
  let response = await page.goto(`${engagementPath}/architecture/elements/${deliverableId}`);
  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe(`${engagementPath}/deliverables/${deliverableId}`);
  response = await page.goto(`${engagementPath}/architecture/elements/${reviewId}`);
  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe(`${engagementPath}/reviews/${reviewId}`);
  response = await page.goto(`${engagementPath}/architecture/elements/${initiativeId}`);
  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe(`${engagementPath}/implementation/${initiativeId}`);

  await page.goto(`${engagementPath}/deliverables/${deliverableId}`);
  const v1Href = (await page.getByRole("link", { name: "v1", exact: true }).getAttribute("href"))!;
  expect(v1Href).toBe(
    `${engagementPath}/deliverables/${deliverableId}?version=${v1Href.split("?version=")[1]}`,
  );
  response = await page.goto(
    `${engagementPath}/architecture/elements/${deliverableId}?version=${v1Href.split("?version=")[1]}`,
  );
  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(v1Href);
  await expect(page.getByRole("heading", { name: "Version 1 as published" })).toBeVisible();

  // Broken links fixed (#4): the initiative's capability shows the
  // initiative through a direct link to its own page, not the generic route.
  await page.goto(`${engagementPath}/architecture/capability`);
  await page.getByRole("link", { name: CAPABILITY }).first().click();
  const implementationLink = page.getByRole("link", { name: new RegExp(INITIATIVE) }).first();
  await expect(implementationLink).toBeVisible();
  expect(await implementationLink.getAttribute("href")).toBe(
    `${engagementPath}/implementation/${initiativeId}`,
  );

  // C2: malformed and well-formed-but-unknown ids fail the same way (404),
  // on every dynamic record route, internal and in the portal.
  const unknown = "00000000-0000-4000-8000-000000000000";
  for (const base of [
    `${engagementPath}/architecture/elements`,
    `${engagementPath}/deliverables`,
    `${engagementPath}/reviews`,
    `${engagementPath}/implementation`,
  ]) {
    expect((await page.goto(`${base}/not-a-uuid`))?.status()).toBe(404);
    expect((await page.goto(`${base}/${unknown}`))?.status()).toBe(404);
  }

  // Cross-engagement: this review's id does not exist under another
  // engagement's path, whether the generic route or its own canonical one.
  expect(
    (await page.goto(`${otherEngagementPath}/architecture/elements/${deliverableId}`))?.status(),
  ).toBe(404);
  expect((await page.goto(`${otherEngagementPath}/deliverables/${deliverableId}`))?.status()).toBe(
    404,
  );

  // Client: a malformed or unknown id in the portal fails the same way, and
  // never as the framework's own crash page.
  const lead = await signedInPage(browser, CLIENT_LEAD.email, TEST_PASSWORD);
  expect((await lead.goto(`${portalPath}/architecture/not-a-uuid`))?.status()).toBe(404);
  expect((await lead.goto(`${portalPath}/architecture/${unknown}`))?.status()).toBe(404);
  await expect(lead.getByText("This page does not exist")).toBeVisible();
});

test("C3: an unexpected error shows the calm boundary, not the framework's own page", async ({
  browser,
}) => {
  const page = await signedInPage(browser, ARCHITECT.email, TEST_PASSWORD);
  let response = await page.goto("/internal/e2e-force-error");
  expect(response?.status()).toBe(500);
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
  await expect(page.getByText(/could not be prepared/)).toBeVisible();

  const lead = await signedInPage(browser, CLIENT_LEAD.email, TEST_PASSWORD);
  response = await lead.goto("/portal/e2e-force-error");
  expect(response?.status()).toBe(500);
  await expect(lead.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
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

/** Publishes the open record's next version from its page. */
async function publish(page: Page, versionNo: number, changeSummary: string) {
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.locator("textarea[name=changeSummary]").fill(changeSummary);
  await page
    .locator("form")
    .getByRole("button", { name: `Publish v${versionNo}` })
    .click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    page.locator("form").getByRole("button", { name: `Publish v${versionNo + 1}` }),
  ).toBeVisible();
  await page.reload();
}

/** Attaches a small PDF to the open deliverable's current version; returns its file id. */
async function attachFile(page: Page, name: string, content: string) {
  await page.locator("input[type=file][name=files]").setInputFiles({
    name,
    mimeType: "application/pdf",
    buffer: Buffer.from(content),
  });
  await page.getByRole("button", { name: "Attach to this version" }).click();
  const link = page.getByRole("link", { name });
  await expect(link).toBeVisible();
  const href = (await link.getAttribute("href"))!;
  return { id: href.split("/").pop()! };
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
