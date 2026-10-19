export function calculateScenarioQuestionnaireScore(instrument, responses) {
  if (instrument === 'SUS') {
    const adjustedTotal = responses.reduce((total, answer, index) => (
      total + (index % 2 === 0 ? answer - 1 : 5 - answer)
    ), 0);
    return {
      score: adjustedTotal * 2.5,
      score_unit: 'SUS points',
      score_summary: 'System Usability Scale (0-100)',
    };
  }

  const score = Object.values(responses)
    .reduce((total, value) => total + value, 0) / 6;
  return {
    score: Math.round(score * 10) / 10,
    score_unit: 'unweighted raw TLX (0-100)',
    score_summary: 'Rata-rata enam dimensi; bukan skor NASA-TLX berbobot',
  };
}
