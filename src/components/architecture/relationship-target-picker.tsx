"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";

type Option = { value: string; label: string };
type TargetOption = { value: string; label: string; search: string };

/**
 * Add-relationship form with a searchable, type-filtered target picker
 * (V1-A F2). The target list is narrowed to only the targets valid for the
 * currently chosen relationship type (reusing the same catalog that
 * already computed each type's candidates server-side), and can be
 * filtered further by typing part of a target's code or title. This
 * replaces offering every element as a target and discovering an invalid
 * pairing only after submit.
 */
export function RelationshipTargetPicker({
  typeOptions,
  targetsByType,
  requiredProficiencyOptions,
  provenanceOptions,
  clientVisibilityOptions,
  action,
}: {
  typeOptions: Option[];
  targetsByType: Record<string, TargetOption[]>;
  requiredProficiencyOptions: Option[];
  provenanceOptions: Option[];
  clientVisibilityOptions: Option[] | null;
  action: (input: Record<string, string>) => Promise<ActionResult<unknown>>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [relationshipType, setRelationshipType] = useState(typeOptions[0]?.value ?? "");
  const [search, setSearch] = useState("");
  const targets = targetsByType[relationshipType] ?? [];
  const [targetElementId, setTargetElementId] = useState(targets[0]?.value ?? "");
  const [requiredProficiency, setRequiredProficiency] = useState("");
  const [provenance, setProvenance] = useState(provenanceOptions[0]?.value ?? "architect_judgment");
  const [clientVisibility, setClientVisibility] = useState("client");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredTargets = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = targetsByType[relationshipType] ?? [];
    if (!q) return pool;
    return pool.filter((t) => t.search.includes(q));
  }, [targetsByType, relationshipType, search]);

  const onChangeType = (value: string) => {
    setRelationshipType(value);
    const pool = targetsByType[value] ?? [];
    setTargetElementId(pool[0]?.value ?? "");
  };

  if (!open) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Add relationship
      </Button>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetElementId) {
      setError("Choose a target.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await action({
        relationshipType,
        targetElementId,
        requiredProficiency,
        provenance,
        description,
        ...(clientVisibilityOptions ? { clientVisibility } : {}),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSearch("");
      setDescription("");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-sm border border-rule bg-surface-muted p-4"
      noValidate
    >
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="This element…" htmlFor="relationship-type">
          <Select
            id="relationship-type"
            value={relationshipType}
            onChange={(e) => onChangeType(e.target.value)}
          >
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Find target"
          htmlFor="relationship-target-search"
          hint="Type part of a code or title."
        >
          <Input
            id="relationship-target-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
          />
        </Field>
        <Field
          label="Target"
          htmlFor="relationship-target"
          className="sm:col-span-2"
          hint={
            filteredTargets.length === 0
              ? "No targets match."
              : `${filteredTargets.length} of ${targets.length} shown`
          }
        >
          <Select
            id="relationship-target"
            value={targetElementId}
            onChange={(e) => setTargetElementId(e.target.value)}
            size={Math.min(8, Math.max(4, filteredTargets.length))}
            className="h-auto py-1"
          >
            {filteredTargets.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        {requiredProficiencyOptions.length > 0 ? (
          <Field label="Required proficiency" htmlFor="relationship-proficiency">
            <Select
              id="relationship-proficiency"
              value={requiredProficiency}
              onChange={(e) => setRequiredProficiency(e.target.value)}
            >
              <option value="">Not applicable</option>
              {requiredProficiencyOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Provenance" htmlFor="relationship-provenance">
          <Select
            id="relationship-provenance"
            value={provenance}
            onChange={(e) => setProvenance(e.target.value)}
          >
            {provenanceOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        {clientVisibilityOptions ? (
          <Field label="Client visibility" htmlFor="relationship-visibility">
            <Select
              id="relationship-visibility"
              value={clientVisibility}
              onChange={(e) => setClientVisibility(e.target.value)}
            >
              {clientVisibilityOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Description" htmlFor="relationship-description" className="sm:col-span-2">
          <Textarea
            id="relationship-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Working…" : "Add relationship"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
