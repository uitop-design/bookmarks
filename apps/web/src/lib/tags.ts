export const MAX_TAGS = 10;
export const TAG_PATTERN = /^[a-z0-9-]{1,24}$/;
export const TAG_HINT = 'Tags use 1-24 letters, digits or hyphens.';

export function normalizeTag(value: string): string {
  return value.trim().replace(/^#+/, '').toLowerCase();
}
