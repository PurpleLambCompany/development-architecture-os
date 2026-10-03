import { expect, test } from "@playwright/test";
import { SEED_PASSWORD, acceptDialogs, closePages, signedInPage } from "./support/auth";
import { resetDatabase, runSql } from "./support/database";

/**
 * V1-A Increment 5 (Workstream D, D8): publishing at scale.
 *
 * Gate A needs at least 150 architecture elements to move through
 * publication without one browser round trip each. This suite seeds the
 * demo database, then uses direct SQL only to create the 150+ draft
 * elements the scale fixture needs (setup, not the thing under test); every
 * assertion about selecting, publishing and authority happens through the
 * real application, against the production build.
 *
 * Authorization, partial success, duplicate-id and cross-engagement
 * behaviour are proven exhaustively in pgTAP
 * (63_bulk_publication, 99_architecture_concurrency); this suite proves the
 * workflow is usable at scale and that an unauthorized user meets the same
 * refusal the database enforces.
 */

const MERIDIAN_SLUG = "meridian-innovation-district";
const MERIDIAN_ID = "e0000000-0000-4000-8000-000000000001";
const ARCHITECT = "architect@tplco.test";
const RESEARCHER = "researcher@tplco.test";
const SCALE_COUNT = 160;
const STAGE_2_DRAFT_ID = "b3000000-0000-4000-8000-000000000207";

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  test.setTimeout(300_000);
  resetDatabase({ seed: true });
});

test.afterEach(closePages);

test("single-element publication still works, unaffected by the bulk path", async ({ browser }) => {
  const page = await signedInPage(browser, ARCHITECT, SEED_PASSWORD);
  acceptDialogs(page);
  await page.goto(
    `/internal/engagements/${MERIDIAN_SLUG}/architecture/elements/${STAGE_2_DRAFT_ID}`,
  );
  await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Publish v1" }).click();
  await page
    .locator("textarea[name=changeSummary]")
    .fill("Individual publish, unaffected by bulk publication.");
  await page.locator("form").getByRole("button", { name: "Publish v1" }).click();
  await expect(page.getByRole("button", { name: "Publish v2" })).toBeVisible();
  await expect(page.getByText("Published", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Version published")).toBeVisible();
});

test("a Researcher (no publish_architecture) is offered no bulk Publish action", async ({
  browser,
}) => {
  // At least one eligible (draft) element must exist for the selection
  // control to be enabled at all.
  runSql(`
    with ins as (
      insert into public.architecture_elements (id, engagement_id, kind, title, provenance)
      values (gen_random_uuid(), '${MERIDIAN_ID}', 'object', 'Researcher-visible draft', 'architect_judgment')
      returning id
    )
    insert into public.architecture_objects (element_id, object_type) select id, 'capability' from ins
  `);

  const page = await signedInPage(browser, RESEARCHER, SEED_PASSWORD);
  await page.goto(`/internal/engagements/${MERIDIAN_SLUG}/architecture/capability`);
  // The Researcher holds edit_architecture, so a Submit-for-review button is
  // offered (disabled until something is selected), but no Publish button
  // exists in the page at all: a bulk Publish action is never rendered for
  // someone who cannot publish individually (defense in depth; the database
  // refuses the capability per element regardless, proven in pgTAP).
  await expect(page.getByRole("button", { name: /^Submit for review \(0\)/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /^Publish \(/ })).toHaveCount(0);
  const selectAll = page.getByRole("checkbox", { name: "Select all eligible elements" });
  await expect(selectAll).toBeVisible();
  await selectAll.check();
  await expect(page.getByRole("button", { name: /^Publish \(/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Submit for review \(/ })).toBeEnabled();
});

test("150+ elements are selected and published together (Gate A scale)", async ({ browser }) => {
  test.setTimeout(120_000);

  // Setup only: 160 draft capability elements, created directly, not through
  // 160 browser round trips.
  runSql(`
    with ins as (
      insert into public.architecture_elements (id, engagement_id, kind, title, provenance)
      select gen_random_uuid(), '${MERIDIAN_ID}', 'object', 'Scale capability ' || g, 'architect_judgment'
      from generate_series(1, ${SCALE_COUNT}) g
      returning id
    )
    insert into public.architecture_objects (element_id, object_type)
    select id, 'capability' from ins
  `);
  expect(
    runSql(
      `select count(*) from public.architecture_elements where engagement_id = '${MERIDIAN_ID}' and title like 'Scale capability %'`,
    ),
  ).toBe(String(SCALE_COUNT));

  const page = await signedInPage(browser, ARCHITECT, SEED_PASSWORD);
  acceptDialogs(page);
  await page.goto(`/internal/engagements/${MERIDIAN_SLUG}/architecture/capability`);

  // Identify the eligible (draft/in-review) set through the application.
  const summary = page.getByText(/publishable elements? in this view/);
  await expect(summary).toBeVisible();
  const summaryText = (await summary.textContent()) ?? "";
  const eligibleCount = Number(summaryText.match(/(\d+)/)?.[1]);
  expect(eligibleCount).toBeGreaterThanOrEqual(SCALE_COUNT);

  // Select all eligible elements in one action.
  await page.getByRole("checkbox", { name: "Select all eligible elements" }).check();
  const publishButton = page.getByRole("button", { name: `Publish (${eligibleCount})` });
  await expect(publishButton).toBeVisible();

  // Initiate publication intentionally; one request publishes the set.
  await publishButton.click();

  // A useful result: success count and any failures, surfaced per element.
  await expect(page.getByText(/Publication result:/)).toBeVisible({ timeout: 30_000 });
  const resultText = (await page.getByText(/Publication result:/).textContent()) ?? "";
  const [, succeeded, total] = resultText.match(/(\d+) of (\d+) succeeded/) ?? [];
  expect(Number(succeeded)).toBe(Number(total));
  expect(Number(total)).toBeGreaterThanOrEqual(SCALE_COUNT);

  // The set reaches the expected published state, and nothing eligible remains.
  expect(
    runSql(
      `select count(*) from public.architecture_elements where engagement_id = '${MERIDIAN_ID}' and title like 'Scale capability %' and lifecycle = 'published'`,
    ),
  ).toBe(String(SCALE_COUNT));
  await page.reload();
  await expect(page.getByText("0 publishable elements in this view")).toBeVisible();

  // Version and audit behaviour for a representative element: open one, see
  // its new version and its own "Version published" activity row.
  const representativeId = runSql(
    `select id from public.architecture_elements where engagement_id = '${MERIDIAN_ID}' and title = 'Scale capability 1'`,
  );
  await page.goto(
    `/internal/engagements/${MERIDIAN_SLUG}/architecture/elements/${representativeId}`,
  );
  await expect(page.getByText("Published", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("v1").first()).toBeVisible();
  await expect(page.getByText("Version published")).toBeVisible();
});
