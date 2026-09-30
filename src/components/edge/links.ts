/** Where a governed record referenced by an Edge item is read. */
export function edgeSubjectHref(
  slug: string,
  subject: { type: string; id: string; kind?: string | null; referenceCode?: string | null },
): string {
  const base = `/internal/engagements/${slug}`;
  switch (subject.type) {
    case "client_action":
      return `${base}/intelligence/requests${subject.referenceCode ? `#${subject.referenceCode}` : ""}`;
    case "method_application":
      return `${base}/method/${subject.id}`;
    case "engagement":
      return `${base}/method`;
    case "acceptance_criterion":
      return `${base}/implementation`;
    default:
      switch (subject.kind) {
        case "implementation_initiative":
          return `${base}/implementation/${subject.id}`;
        case "review":
          return `${base}/reviews/${subject.id}`;
        case "deliverable":
          return `${base}/deliverables/${subject.id}`;
        default:
          return `${base}/architecture/elements/${subject.id}`;
      }
  }
}
