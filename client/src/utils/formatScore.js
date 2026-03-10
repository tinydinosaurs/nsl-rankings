/**
 * Formats a numeric score to one decimal place.
 * Returns '—' for null/undefined values.
 */
export function formatScore(val) {
  if (val === null || val === undefined) return '—';
  return (Math.round(val * 10) / 10).toFixed(1);
}
