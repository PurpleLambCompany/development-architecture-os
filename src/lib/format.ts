const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Formats a `YYYY-MM-DD` date column (no time zone shift). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  return dateFormatter.format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

export function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  return start ? `From ${formatDate(start)}` : `Until ${formatDate(end)}`;
}

export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

export function personName(
  profile: { first_name?: string | null; last_name?: string | null; email?: string | null } | null,
): string {
  if (!profile) return "Unknown";
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  return name || profile.email || "Unknown";
}
