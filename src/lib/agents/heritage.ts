import { UK_PLANNING_SOURCES } from '../uk-sources';
import { AgentInputContext, buildAgentResult } from './base';

export const HeritageAgent = {
  type: 'heritage' as const,

  evaluate(input: AgentInputContext) {
    const data = input.extractedData || {};
    const inConservation = !!data.conservationZone;
    const proposedHeight = data.proposedHeight ?? 3;

    let score = 98;
    let decision: 'approve' | 'reject' | 'review' = 'approve';
    const evidence: string[] = [];
    const policyRefs: string[] = [UK_PLANNING_SOURCES.heritage.reference];
    const contradictions: string[] = [];

    if (inConservation) {
      evidence.push('Property is located in a conservation area.');
      policyRefs.push('NPPF, chapter 16');

      if (proposedHeight > 3.2) {
        score = 48;
        decision = 'reject';
        evidence.push(`Proposed height of ${proposedHeight}m is visually assertive for a heritage setting.`);
        evidence.push('The drawing set does not yet show a clear context-led material strategy.');
        contradictions.push('The policy and heritage checks disagree on whether the current massing is acceptable.');
      } else {
        score = 74;
        decision = 'review';
        evidence.push(`Proposed height of ${proposedHeight}m is modest, but heritage detailing still needs to be shown.`);
      }
    } else {
      evidence.push('No designated heritage asset or conservation boundary is indicated by the current input.');
    }

    const confidence = Math.max(50, Math.min(97, score));

    return buildAgentResult({
      applicationId: input.applicationId,
      agentType: 'heritage',
      score,
      confidence,
      decision,
      reasoning:
        inConservation && decision === 'reject'
          ? 'Section 72 of the Planning (Listed Buildings and Conservation Areas) Act 1990 requires special attention to the character and appearance of conservation areas, and the current design is too dominant.'
          : inConservation
          ? 'The site is in a conservation area and can potentially proceed, but only if the design is refined with stronger context-sensitive details.'
          : 'The site is not within a conservation area, so heritage risk is low on the current inputs.',
      evidence,
      policyRefs,
      contradictions,
    });
  },
};
