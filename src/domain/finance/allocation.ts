/**
 * Suggested allocation of a payment: oldest due first. It is only a
 * suggestion for the person recording the payment, who confirms or edits
 * it. The system never applies money on its own. Proposal §5.
 */

export type OpenInvoice = {
  id: string;
  invoiceNumber: string;
  dueDate: string;
  balanceMinor: number;
};

export type AllocationLine = { invoiceId: string; amountMinor: number };

export function suggestAllocations(
  paymentMinor: number,
  invoices: readonly OpenInvoice[],
): { lines: AllocationLine[]; unappliedMinor: number } {
  let remaining = Math.max(0, paymentMinor);
  const lines: AllocationLine[] = [];
  const ordered = [...invoices]
    .filter((invoice) => invoice.balanceMinor > 0)
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) || a.invoiceNumber.localeCompare(b.invoiceNumber),
    );
  for (const invoice of ordered) {
    if (remaining === 0) break;
    const amount = Math.min(remaining, invoice.balanceMinor);
    lines.push({ invoiceId: invoice.id, amountMinor: amount });
    remaining -= amount;
  }
  return { lines, unappliedMinor: remaining };
}

/** Checks a proposed allocation before it is sent (the database re-checks). */
export function allocationProblems(
  paymentMinor: number,
  lines: readonly AllocationLine[],
  invoices: readonly OpenInvoice[],
): string[] {
  const problems: string[] = [];
  const total = lines.reduce((sum, line) => sum + line.amountMinor, 0);
  if (total > paymentMinor) problems.push("The allocations add up to more than the payment.");
  const seen = new Set<string>();
  for (const line of lines) {
    const invoice = invoices.find((i) => i.id === line.invoiceId);
    if (!invoice) {
      problems.push("An allocation refers to an invoice that is not open.");
      continue;
    }
    if (seen.has(line.invoiceId)) problems.push(`${invoice.invoiceNumber} is listed twice.`);
    seen.add(line.invoiceId);
    if (line.amountMinor <= 0)
      problems.push(`The amount for ${invoice.invoiceNumber} must be positive.`);
    if (line.amountMinor > invoice.balanceMinor) {
      problems.push(`The amount for ${invoice.invoiceNumber} is more than its balance.`);
    }
  }
  return problems;
}
