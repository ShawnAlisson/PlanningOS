const cases = [
  {
    name: 'normal single-storey rear extension',
    description: 'Proposed single storey rear extension, 3.2m high, modest depth.',
    expected: { highways: 'approve', neighbour: 'approve', note: 'Description changes project fields only.' },
  },
  {
    name: 'over-height proposal',
    description: 'Two storey rear extension around 5m high.',
    expected: { policy: 'review', note: 'Height should pull compliance down; postcode constraints do not move.' },
  },
  {
    name: '50m into the street/highway',
    description: 'The proposed extension projects 50m into the street and blocks the main highway.',
    expected: { highways: 'review', note: 'Highway wording affects the highways heuristic, but does not change geocoded site point.' },
  },
  {
    name: 'high overlooking/privacy impact',
    description: 'Large side windows cause overlooking, privacy loss and overbearing impact to neighbours.',
    expected: { neighbour: 'reject', note: 'Neighbour wording should produce high impact when extracted.' },
  },
];

function deterministicExtract(description) {
  const text = description.toLowerCase();
  return {
    extensionType: text.includes('loft') || text.includes('roof') ? 'loft' : text.includes('side') ? 'side' : 'rear',
    proposedHeight: text.includes('two storey') || text.includes('two-storey') ? 5 : text.includes('single storey') ? 3.2 : 2.8,
    highwaysProximity: text.includes('highway') || text.includes('main road'),
    neighbourImpactLevel: text.includes('overlooking') || text.includes('overbear') ? 'high' : text.includes('privacy') ? 'medium' : 'low',
  };
}

function highwaysDecision(data) {
  return data.highwaysProximity ? { decision: 'review', score: 72 } : { decision: 'approve', score: 99 };
}

function neighbourDecision(data) {
  if (data.neighbourImpactLevel === 'high') return { decision: 'reject', score: 42 };
  if (data.neighbourImpactLevel === 'medium') return { decision: 'review', score: 76 };
  return { decision: 'approve', score: 94 };
}

console.log('PlanningOS repeatable description/agent evaluation');
console.log('Postcode/site constraints are intentionally held constant in these cases.\n');

for (const item of cases) {
  const extracted = deterministicExtract(item.description);
  console.log(`- ${item.name}`);
  console.log(`  extracted=${JSON.stringify(extracted)}`);
  console.log(`  highways=${JSON.stringify(highwaysDecision(extracted))}`);
  console.log(`  neighbour=${JSON.stringify(neighbourDecision(extracted))}`);
  console.log(`  expected=${JSON.stringify(item.expected)}\n`);
}
