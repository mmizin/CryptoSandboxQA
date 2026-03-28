/**
 * Shared limits for search / filter text inputs (markets, trade tables, admin search).
 */

export const SEARCH_MAX_LENGTH = 128;

export function clampSearchInput(value: string): string {
  return value.trimStart().slice(0, SEARCH_MAX_LENGTH);
}
