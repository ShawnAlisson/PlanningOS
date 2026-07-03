import { UK_PLANNING_SOURCES } from '../uk-sources';
import { AgentInputContext, buildAgentResult } from './base';

export const FloodRiskAgent = {
  type: 'flood' as const,

  evaluate(input: AgentInputContext) {
    const data = input.extractedData || {};
    const floodZone = data.floodZone || 'Zone 1';
    const floodEntities = input.siteConstraints?.floodRiskZones || [];

    let score = 100;
    let decision: 'approve' | 'reject' | 'review' = 'approve';
    const evidence: string[] = [];
    const policyRefs: string[] = [UK_PLANNING_SOURCES.flood.reference];
    const contradictions: string[] = [];

    if (floodEntities.length > 0) {
      evidence.push(`Real record: ${floodEntities.length} Environment Agency flood-risk-zone polygon(s) intersect this point (planning.data.gov.uk).`);
      floodEntities.slice(0, 3).forEach((entity) => {
        evidence.push(`${entity.floodRiskType || 'Flood zone'} — risk level ${entity.floodRiskLevel || '?'}. Source: ${entity.entityUrl}`);
      });
    } else {
      evidence.push(`Flood zone: ${floodZone} (no flood-risk-zone record intersects this point in planning.data.gov.uk, treated as Zone 1).`);
    }

    if (floodZone.startsWith('Zone 3')) {
      score = 28;
      decision = 'reject';
      evidence.push('High probability flood zone identified.');
      evidence.push('A site-specific Flood Risk Assessment would normally be expected.');
      contradictions.push('Flood risk is materially worse than the policy agent assumes for a simple householder review.');
    } else if (floodZone === 'Zone 2') {
      score = 69;
      decision = 'review';
      evidence.push('Medium probability flood zone identified.');
      evidence.push('Flood-resilient design and drainage measures should be provided.');
    } else {
      evidence.push('Low probability flood zone identified.');
    }

    const confidence = Math.max(52, Math.min(98, score));

    return buildAgentResult({
      applicationId: input.applicationId,
      agentType: 'flood',
      score,
      confidence,
      decision,
      reasoning:
        floodZone.startsWith('Zone 3')
          ? 'The proposal is in Flood Zone 3, so the application should be treated as high risk until a proper flood strategy is available.'
          : floodZone === 'Zone 2'
          ? 'The site is in Flood Zone 2 and is still potentially workable, but it should be reviewed with flood-resilient measures.'
          : 'The site is in Flood Zone 1, which is the lowest risk category in this simplified MVP check.',
      evidence,
      policyRefs,
      contradictions,
    });
  },
};
