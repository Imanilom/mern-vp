const DEFAULT_ALLOWED_ORIGINS = [
  'https://vidyamedic.my.id',
  'https://www.vidyamedic.my.id',
];

const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

export function parseAllowedOrigins(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return [...DEFAULT_ALLOWED_ORIGINS];
  }

  const origins = value.split(',').map((entry) => entry.trim()).filter(Boolean);
  const normalized = origins.map((origin) => {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`ALLOWED_ORIGINS contains an invalid origin: ${origin}`);
    }
    if (
      !['http:', 'https:'].includes(parsed.protocol)
      || parsed.username
      || parsed.password
      || parsed.pathname !== '/'
      || parsed.search
      || parsed.hash
    ) {
      throw new Error(`ALLOWED_ORIGINS must contain only HTTP(S) origins: ${origin}`);
    }
    return parsed.origin;
  });

  return [...new Set(normalized)];
}

export function isAllowedOrigin(origin, allowedOrigins, allowLocalhost = false) {
  if (!origin) return true;
  return allowedOrigins.includes(origin)
    || (allowLocalhost && LOCAL_ORIGIN_PATTERN.test(origin));
}
