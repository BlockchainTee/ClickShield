const TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Returns a deterministic timestamp value for sorting and window comparisons.
 */
export function parseThreatTimestamp(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Formats a dashboard timestamp into a stable, readable label.
 */
export function formatThreatTimestamp(value: string): string {
  const parsed = parseThreatTimestamp(value);
  if (parsed === 0) {
    return "Unavailable";
  }

  return TIMESTAMP_FORMATTER.format(new Date(parsed));
}
