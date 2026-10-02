import { expect, test, type Page } from "@playwright/test";
import { SEED_PASSWORD, closePages, signedInPage } from "./support/auth";
import { resetDatabase, runSql, sqlLiteral } from "./support/database";

/**
 * Seeded demo smoke (V1-A browser run 2). With the demo seed loaded, every
 * navigation destination each role is offered, and a representative detail
 * page of each record kind, must render without a server error, a redirect
 * or a not-found page. Clients must stay inside their own engagement.
 *
 * Navigation destinations are discovered from the menus the person actually
 * sees, so a route added to a menu is covered without changing this file.
 */

const MERIDIAN = "meridian-innovation-district";
const HARBOR = "harbor-community-expansion";

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  test.setTimeout(300_000);
  resetDatabase({ seed: true });
});

test.afterEach(closePages);

/** Same-origin paths of the links inside the named navigation landmark. */
async function navigationPaths(page: Page, landmark: string): Promise<string[]> {
  const nav = page.getByRole("navigation", { name: landmark, exact: true });
  await expect(nav).toBeVisible();
  const hrefs = await nav
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
  const origin = new URL(page.url()).origin;
  const paths = hrefs
    .map((href) => new URL(href))
    .filter((url) => url.origin === origin)
    .map((url) => url.pathname + url.search);
  expect(paths.length).toBeGreaterThan(0);
  return [...new Set(paths)];
}

/**
 * Opens each path and asserts it renders that page: a success status, no
 * redirect elsewhere (such as to sign-in), no not-found or error page, and
 * no uncaught error in the browser.
 */
async function expectEachRenders(page: Page, paths: string[]) {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  for (const path of paths) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} status`).toBeLessThan(400);
    const landed = new URL(page.url());
    expect(landed.pathname + landed.search, `${path} did not redirect`).toBe(path);
    await expect(page.getByRole("main"), `${path} renders its main content`).toBeVisible();
    await expect(page.getByText(/This page couldn.t load/)).toHaveCount(0);
    await expect(page.getByText("This page does not exist")).toHaveCount(0);
  }
  expect(browserErrors, "uncaught browser errors").toEqual([]);
}

/** The id of the first element of `kind` on an engagement (seed data). */
function elementId(engagementSlug: string, kind: string): string {
  const id = runSql(`
    select e.id from public.architecture_elements e
    join public.engagements g on g.id = e.engagement_id
    where g.slug = ${sqlLiteral(engagementSlug)} and e.kind = ${sqlLiteral(kind)}
    order by e.reference_code limit 1`);
  expect(id, `a seeded ${kind} on ${engagementSlug}`).not.toBe("");
  return id;
}

const internalPeople = [
  { email: "principal@tplco.test", role: "Principal Architect", engagement: true },
  { email: "architect@tplco.test", role: "Architect", engagement: true },
  { email: "researcher@tplco.test", role: "Researcher", engagement: true },
  { email: "sysadmin@tplco.test", role: "System Administrator", engagement: true },
  { email: "finance@tplco.test", role: "Finance Administrator", engagement: false },
];

for (const person of internalPeople) {
  test(`internal navigation renders for a ${person.role}`, async ({ browser }) => {
    const page = await signedInPage(browser, person.email, SEED_PASSWORD);
    await expect(page).toHaveURL(/\/internal/);
    await expectEachRenders(page, await navigationPaths(page, "Internal"));

    if (person.engagement) {
      await page.goto(`/internal/engagements/${MERIDIAN}`);
      await expectEachRenders(page, await navigationPaths(page, "Architecture"));
    }
  });
}

test("internal detail pages of each record kind render", async ({ browser }) => {
  const page = await signedInPage(browser, "principal@tplco.test", SEED_PASSWORD);
  const meridian = `/internal/engagements/${MERIDIAN}`;
  const harbor = `/internal/engagements/${HARBOR}`;
  await expectEachRenders(page, [
    "/internal/organizations/tplco",
    "/internal/organizations/meridian-development-authority",
    `/internal/finance/${MERIDIAN}`,
    `${meridian}/architecture/elements/${elementId(MERIDIAN, "object")}`,
    `${meridian}/architecture/elements/${elementId(MERIDIAN, "decision")}`,
    `${harbor}/deliverables/${elementId(HARBOR, "deliverable")}`,
    `${harbor}/reviews/${elementId(HARBOR, "review")}`,
    `${harbor}/implementation/${elementId(HARBOR, "implementation_initiative")}`,
  ]);
});

const clients = [
  { email: "sponsor@meridian.test", role: "Meridian Executive Sponsor", slug: MERIDIAN },
  { email: "viewer@meridian.test", role: "Meridian Client Viewer", slug: MERIDIAN },
  { email: "sponsor@harbor.test", role: "Harbor Executive Sponsor", slug: HARBOR },
];

for (const person of clients) {
  test(`portal navigation renders for the ${person.role}`, async ({ browser }) => {
    const page = await signedInPage(browser, person.email, SEED_PASSWORD);
    await expect(page).toHaveURL(/\/portal/);
    await page.goto(`/portal/${person.slug}`);
    await expectEachRenders(page, await navigationPaths(page, "Engagement"));
  });
}

test("a client opens a published element's detail page", async ({ browser }) => {
  const page = await signedInPage(browser, "sponsor@meridian.test", SEED_PASSWORD);
  await page.goto(`/portal/${MERIDIAN}/architecture`);
  // Element links are labelled with their reference code, such as "KNW-001 …".
  const first = page
    .getByRole("main")
    .getByRole("link", { name: /^[A-Z]{3}-\d{3} / })
    .first();
  const href = await first.getAttribute("href");
  expect(href).toMatch(new RegExp(`^/portal/${MERIDIAN}/architecture/`));
  await expectEachRenders(page, [href!]);
});

test("navigation works by clicking, internally and in the portal", async ({ browser }) => {
  const internal = await signedInPage(browser, "principal@tplco.test", SEED_PASSWORD);
  await internal
    .getByRole("navigation", { name: "Internal", exact: true })
    .getByRole("link", { name: "Active" })
    .click();
  await expect(internal).toHaveURL(/\/internal\/engagements\?view=active$/);
  await internal.getByRole("link", { name: "Regional Innovation District" }).first().click();
  await expect(internal).toHaveURL(`/internal/engagements/${MERIDIAN}`);

  const client = await signedInPage(browser, "sponsor@meridian.test", SEED_PASSWORD);
  await client.goto(`/portal/${MERIDIAN}`);
  await client
    .getByRole("navigation", { name: "Engagement", exact: true })
    .getByRole("link", { name: "Architecture" })
    .click();
  await expect(client).toHaveURL(`/portal/${MERIDIAN}/architecture`);
});

test("a client cannot reach another client's engagement or the internal app", async ({
  browser,
}) => {
  const page = await signedInPage(browser, "sponsor@harbor.test", SEED_PASSWORD);
  const response = await page.goto(`/portal/${MERIDIAN}`);
  expect(response?.status()).toBe(404);
  await expect(page.getByText("This page does not exist")).toBeVisible();
  await expect(page.getByText("Regional Innovation District")).toHaveCount(0);

  await page.goto("/internal");
  await expect(page).toHaveURL(/\/portal/);
});
