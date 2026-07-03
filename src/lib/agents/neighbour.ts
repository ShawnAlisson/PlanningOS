import { UK_PLANNING_SOURCES } from '../uk-sources';
import { AgentInputContext, buildAgentResult } from './base';

export const NeighbourImpactAgent = {
  type: 'neighbour' as const,

  evaluate(input: AgentInputContext) {
    const data = input.extractedData || {};
    const impact = data.neighbourImpactLevel || 'low';

    let score = 100;
    let decision: 'approve' | 'reject' | 'review' = 'approve';
    const evidence: string[] = [];
    const policyRefs: string[] = [UK_PLANNING_SOURCES.neighbour.reference, 'Local amenity policy'];
    const contradictions: string[] = [];

    evidence.push(`Neighbour impact level: ${impact.toUpperCase()}.`);

    if (impact === 'high') {
      score = 42;
      decision = 'reject';
      evidence.push('The current massing is likely to create overbearing or daylight issues.');
      evidence.push('A detailed daylight and privacy study would be needed to overcome this.');
      contradictions.push('Neighbour amenity is inconsistent with the more permissive policy view.');
    } else if (impact === 'medium') {
      score = 76;
      decision = 'review';
      evidence.push('A moderate amenity impact is possible, but it looks manageable with design conditions.');
    } else {
      score = 94;
      decision = 'approve';
      evidence.push('No significant overlooking or daylight loss is indicated by the current input.');
    }

    const confidence = Math.max(54, Math.min(98, score));

    return buildAgentResult({
      applicationId: input.applicationId,
      agentType: 'neighbour',
      score,
      confidence,
      decision,
      reasoning:
        impact === 'high'
          ? 'The proposal is likely to cause unacceptable neighbour harm until the design is reduced or more detailed evidence is provided.'
          : impact === 'medium'
          ? 'There is a moderate neighbour-amenity issue, but it can usually be resolved with proportionate conditions.'
          : 'The neighbour impact is low based on the current structured input.',
      evidence,
      policyRefs,
      contradictions,
    });
  },
};
