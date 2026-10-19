const HISTORY_CATEGORIES = new Set([
  'all',
  'baseline',
  'deviation',
  'recovery',
  'recording',
  'learning',
]);

export function parsePatientCaparHistoryQuery(query = {}) {
  const category = query.category ?? 'all';
  if (typeof category !== 'string' || !HISTORY_CATEGORIES.has(category)) {
    return null;
  }

  const rawLimit = query.limit ?? '25';
  const limit = Number(rawLimit);
  if (
    (typeof rawLimit !== 'string' && typeof rawLimit !== 'number')
    || !Number.isInteger(limit)
    || limit < 1
    || limit > 100
  ) {
    return null;
  }

  let cursor = null;
  if (query.before != null) {
    if (typeof query.before !== 'string') return null;
    const match = /^(\d{10,13}):([a-f\d]{24})$/i.exec(query.before);
    if (!match) return null;
    const timestamp = Number(match[1]);
    if (!Number.isSafeInteger(timestamp) || timestamp <= 0) return null;
    cursor = {
      timestamp,
      id: match[2].toLowerCase(),
    };
  }

  return { category, limit, cursor };
}
