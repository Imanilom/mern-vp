const FACTOR_LABELS = {
  mood: 'Mood',
  meal: 'Makan',
  stress: 'Stres',
  physical_activity: 'Aktivitas fisik',
  sleep: 'Tidur',
  other: 'Faktor lain',
};

export function rankPersonalReportedFactors(checkIns = []) {
  const scores = new Map();
  for (const checkIn of checkIns) {
    const factors = checkIn.deviation_follow_up?.ranked_context_factors || [];
    const uniqueFactors = [...new Set(factors)];
    for (const [index, factor] of uniqueFactors.entries()) {
      const entry = scores.get(factor) || { factor, events: 0, points: 0, rankTotal: 0 };
      entry.events += 1;
      entry.points += uniqueFactors.length - index;
      entry.rankTotal += index + 1;
      scores.set(factor, entry);
    }
  }

  return [...scores.values()]
    .map((item) => ({
      ...item,
      label: FACTOR_LABELS[item.factor] || item.factor.replaceAll('_', ' '),
      averageRank: item.rankTotal / item.events,
    }))
    .sort((first, second) => (
      second.points - first.points
      || second.events - first.events
      || first.averageRank - second.averageRank
      || first.factor.localeCompare(second.factor)
    ));
}
