import { UK_PLANNING_SOURCES } from '../uk-sources';
import { AgentInputContext, buildAgentResult } from './base';

export const HighwaysAgent = {
  type: 'highways' as const,

  evaluate(input: AgentInputContext) {
    const data = input.extractedData || {};
    const highwaysProximity = !!data.highwaysProximity;

    let score = 99;
    let decision: 'approve' | 'reject' | 'review' = 'approve';
    const evidence: string[] = [];
    const policyRefs: string[] = [UK_PLANNING_SOURCES.highways.reference];
    const contradictions: string[] = [];

    if (highwaysProximity) {
      score = 72;
      decision = 'review';
      evidence.push('The site is close to a highway or access route.');
      evidence.push('Construction access, skips, or scaffolding may need a management condition.');
      contradictions.push('Highways risk is manageable, but it may conflict with the neighbour or policy view if site access is tight.');
    } else {
      evidence.push('No obvious highway access conflict is indicated by the current input.');
    }

    const confidence = Math.max(55, Math.min(97, score));

    return buildAgentResult({
      applicationId: input.applicationId,
      agentType: 'highways',
      score,
      confidence,
      decision,
      reasoning: highwaysProximity
        ? 'The site is close to a highway, so the project should be reviewed with a construction management condition.'
        : 'The site is sufficiently set back from the highway on the current data.',
      evidence,
      policyRefs,
      contradictions,
    });
  },
};
