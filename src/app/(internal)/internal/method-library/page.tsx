import Link from "next/link";
import { DOMAINS, DOMAIN_SHORT_LABELS } from "@/domain/architecture/catalog";
import { createMethodAssetAndOpen } from "@/domain/methodology/actions";
import {
  FORMS,
  METHOD_ASSET_FORMS,
  METHOD_ASSET_ORIGINS,
  ORIGIN,
} from "@/domain/methodology/catalog";
import {
  getDamReleases,
  getDevelopmentContexts,
  getMethodCategories,
  getMethodLibrary,
  getMyPracticeCapabilities,
} from "@/domain/methodology/queries";
import { requireInternal } from "@/lib/auth/viewer";
import { AssetStatusTag, FormBadge, ReleaseChip } from "@/components/methodology/badges";
import { LibraryNav } from "@/components/methodology/library-nav";
import { ActionForm } from "@/components/ui/action-form";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";

/**
 * The Method Library (Phase 6 §29.1): TPLCo's governed methodology, by form.
 * Internal only; the database returns nothing here to a client. The default
 * view is the active assets in the current published DAM release.
 */
export default async function MethodLibraryPage({
  searchParams,
}: PageProps<"/internal/method-library">) {
  await requireInternal();
  const query = await searchParams;
  const pick = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : "");
  const filters = {
    q: pick("q").toLowerCase(),
    form: pick("form"),
    category: pick("category"),
    domain: pick("domain"),
    context: pick("context"),
    scope: pick("scope") || "release",
  };
  const [rows, categories, releases, contexts, practice] = await Promise.all([
    getMethodLibrary(),
    getMethodCategories(),
    getDamReleases(),
    getDevelopmentContexts(),
    getMyPracticeCapabilities(),
  ]);
  const current = releases.find((r) => r.status === "published");
  const categoryLabel = new Map(categories.map((c) => [c.key, c.label]));

  const shown = rows.filter((row) => {
    if (
      filters.scope === "release" &&
      !(current && row.release_labels.includes(current.version_label))
    ) {
      return false;
    }
    if (
      filters.scope === "working" &&
      (row.status === "retired" || (current && row.release_labels.includes(current.version_label)))
    ) {
      return false;
    }
    if (filters.form && (filters.form === "legacy" ? row.form !== null : row.form !== filters.form))
      return false;
    if (filters.category && row.category_key !== filters.category) return false;
    if (filters.domain && !row.domains.includes(filters.domain as (typeof DOMAINS)[number]))
      return false;
    if (filters.context && !row.context_keys.includes(filters.context)) return false;
    if (filters.q) {
      const haystack = `${row.title} ${row.key} ${row.architectural_question ?? ""}`.toLowerCase();
      if (!haystack.includes(filters.q)) return false;
    }
    return true;
  });

  const scopeLink = (scope: string) => {
    const params = new URLSearchParams(
      Object.entries({ ...filters, scope }).filter(([, v]) => v) as [string, string][],
    );
    return `/internal/method-library?${params.toString()}`;
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Practice"
        title="Method Library"
        description="TPLCo's governed methodology: Methods performed, Models applied, Standards judged against, Instruments used within and Templates produced from. Internal only."
      />
      <LibraryNav current="assets" />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {[
          {
            scope: "release",
            label: current ? `In DAM ${current.version_label}` : "In the current release",
          },
          { scope: "working", label: "Outside the current release" },
          { scope: "all", label: "Everything, including retired" },
        ].map((s) => (
          <Link
            key={s.scope}
            href={scopeLink(s.scope)}
            aria-current={filters.scope === s.scope ? "true" : undefined}
            className={
              filters.scope === s.scope ? "font-medium text-ink" : "text-ink-muted hover:text-ink"
            }
          >
            {s.label}
          </Link>
        ))}
      </div>

      <form method="get" className="rounded-sm border border-rule bg-surface px-5 py-4">
        <input type="hidden" name="scope" value={filters.scope} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <label className="col-span-2 space-y-1 text-xs text-ink-subtle">
            <span className="block tracking-wide uppercase">Search</span>
            <Input
              name="q"
              defaultValue={pick("q")}
              placeholder="Title or question"
              className="h-9"
            />
          </label>
          <FilterSelect
            name="form"
            label="Form"
            value={filters.form}
            options={[
              ...METHOD_ASSET_FORMS.map((f) => ({ value: f, label: FORMS[f].label })),
              { value: "legacy", label: "Legacy" },
            ]}
          />
          <FilterSelect
            name="category"
            label="Category"
            value={filters.category}
            options={categories.map((c) => ({ value: c.key, label: c.label }))}
          />
          <FilterSelect
            name="domain"
            label="Domain"
            value={filters.domain}
            options={DOMAINS.map((d) => ({ value: d, label: DOMAIN_SHORT_LABELS[d] }))}
          />
          <FilterSelect
            name="context"
            label="Context"
            value={filters.context}
            options={contexts.map((c) => ({ value: c.key, label: c.label }))}
          />
        </div>
        <div className="mt-3 flex gap-3 text-sm">
          <button type="submit" className="text-accent hover:underline">
            Apply
          </button>
          <Link href="/internal/method-library" className="text-ink-muted hover:text-ink">
            Clear
          </Link>
        </div>
      </form>

      <Panel
        title={`${shown.length} ${shown.length === 1 ? "asset" : "assets"}`}
        actions={
          practice.canAuthor ? (
            <ActionForm
              trigger="New asset"
              submitLabel="Create and open the first draft"
              action={createMethodAssetAndOpen}
              fields={[
                { name: "title", label: "Title", wide: true },
                {
                  name: "key",
                  label: "Key",
                  hint: "Lowercase, dashes, e.g. capability-readiness-diagnostic",
                },
                {
                  name: "form",
                  label: "Form",
                  type: "select",
                  options: METHOD_ASSET_FORMS.map((f) => ({
                    value: f,
                    label: `${FORMS[f].label}: ${FORMS[f].verb}`,
                  })),
                },
                {
                  name: "categoryKey",
                  label: "Category",
                  type: "select",
                  options: categories
                    .filter((c) => c.active)
                    .map((c) => ({ value: c.key, label: c.label })),
                },
                {
                  name: "origin",
                  label: "Origin",
                  type: "select",
                  options: METHOD_ASSET_ORIGINS.map((o) => ({ value: o, label: ORIGIN[o] })),
                },
              ]}
              defaultValues={{
                form: "method",
                categoryKey: categories[0]?.key ?? "other",
                origin: "tplco_developed",
              }}
            />
          ) : null
        }
      >
        {shown.length === 0 ? (
          <EmptyState title="No assets match">
            {filters.scope === "release"
              ? "Assets not yet in the current release are under “Outside the current release”."
              : null}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-rule">
            {shown.map((row) => (
              <li key={row.asset_id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <FormBadge form={row.form} />
                  <Link
                    href={`/internal/method-library/${row.asset_id}`}
                    className="font-serif text-base text-ink hover:underline"
                  >
                    {row.title}
                  </Link>
                  {row.status === "retired" ? <AssetStatusTag status={row.status} /> : null}
                  {row.has_draft ? (
                    <span className="text-xs text-attention">Draft in progress</span>
                  ) : null}
                </div>
                {row.architectural_question ? (
                  <p className="mt-1 text-sm text-ink">{row.architectural_question}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-subtle">
                  <span>{categoryLabel.get(row.category_key) ?? row.category_key}</span>
                  <span>
                    {row.version_label
                      ? `Version ${row.version_label}`
                      : "No published version yet"}
                  </span>
                  {row.release_labels.map((label) => (
                    <ReleaseChip key={label} label={label} />
                  ))}
                  <span>
                    {row.form === "method"
                      ? `Applied ${row.application_count} ${row.application_count === 1 ? "time" : "times"}`
                      : row.lineage_count > 0
                        ? `Cited by ${row.lineage_count} ${row.lineage_count === 1 ? "element" : "elements"}`
                        : "Not yet cited"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="space-y-1 text-xs text-ink-subtle">
      <span className="block tracking-wide uppercase">{label}</span>
      <Select name={name} defaultValue={value} className="h-9">
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  );
}
