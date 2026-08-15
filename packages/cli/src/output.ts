/**
 * Format data as JSON for display.
 */
export function formatJSON(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Mask a secret value for display. Returns a fixed-width mask so the
 * original length is not leaked; empty values render as "(empty)".
 */
export function maskSecret(value: string): string {
  return value.length === 0 ? "(empty)" : "••••••••";
}
