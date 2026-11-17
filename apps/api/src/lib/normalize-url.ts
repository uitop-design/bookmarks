export const MAX_URL_LENGTH = 2048;

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const TRACKING_PARAMS = new Set(['fbclid', 'gclid']);

export class InvalidUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUrlError';
  }
}

function decodeQueryKey(pair: string): string {
  const rawKey = pair.split('=', 1)[0] ?? '';
  try {
    return decodeURIComponent(rawKey.replaceAll('+', ' ')).toLowerCase();
  } catch {
    return rawKey.toLowerCase();
  }
}

function isTrackingParam(key: string): boolean {
  return key.startsWith('utm_') || TRACKING_PARAMS.has(key);
}

export function isHttpUrl(url: URL): boolean {
  return ALLOWED_PROTOCOLS.has(url.protocol);
}

export function normalizeUrl(input: string): string {
  const value = input.trim();
  if (value.length > MAX_URL_LENGTH) {
    throw new InvalidUrlError(`URL must be at most ${MAX_URL_LENGTH} characters`);
  }
  if (!URL.canParse(value)) {
    throw new InvalidUrlError('URL must be an absolute http or https URL');
  }

  const url = new URL(value);
  if (!isHttpUrl(url)) {
    throw new InvalidUrlError('Only http and https URLs are supported');
  }
  if (url.username || url.password) {
    throw new InvalidUrlError('URL must not contain credentials');
  }

  url.hash = '';
  const keptParams = url.search
    .slice(1)
    .split('&')
    .filter((pair) => pair !== '' && !isTrackingParam(decodeQueryKey(pair)));
  url.search = keptParams.length > 0 ? `?${keptParams.join('&')}` : '';
  if (url.pathname !== '/') {
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  }

  const normalized = url.href;
  if (normalized.length > MAX_URL_LENGTH) {
    throw new InvalidUrlError(`URL must be at most ${MAX_URL_LENGTH} characters`);
  }
  return normalized;
}

export function hostnameOf(url: string): string {
  return new URL(url).hostname;
}
