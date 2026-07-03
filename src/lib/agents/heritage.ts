import { UK_PLANNING_SOURCES } from '../uk-sources';
import { AgentInputContext, buildAgentResult } from './base';

export const HeritageAgent = {
  type: 'heritage' as const,

  evaluate(input: AgentInputContext) {
    const data = input.extractedData || {};
    const constraints = input.siteConstraints;
    const conservationAreas = constraints?.conservationAreas || [];
    const listedBuildings = constraints?.listedBuildings || [];
    const scheduledMonuments = constraints?.scheduledMonuments || [];
    const inConservation = conservationAreas.length > 0 || !!data.conservationZone;
    const proposedHeight = data.proposedHeight ?? 3;

    let score = 98;
    let decision: 'approve' | 'reject' | 'review' = 'approve';
    const evidence: string[] = [];
    const policyRefs: string[] = [UK_PLANNING_SOURCES.heritage.reference];
    const contradictions: string[] = [];

    if (conservationAreas.length > 0) {
      conservationAreas.forEach((area) => {
        evidence.push(`Real record: within "${area.name}" conservation area (planning.data.gov.uk entity ${area.entityId}). Source: ${area.entityUrl}`);
      });
    }

    let listedOrMonumentPenalty = 0;

    if (listedBuildings.length > 0) {
      listedBuildings.forEach((building) => {
        evidence.push(
          `Real record: listed building "${building.name}"${building.listedBuildingGrade ? ` (Grade ${building.listedBuildingGrade})` : ''} intersects the site point. Source: ${building.entityUrl}`
        );
      });
      listedOrMonumentPenalty += 20;
      policyRefs.push('Planning (Listed Buildings and Conservation Areas) Act 1990, section 66');
    }

    if (scheduledMonuments.length > 0) {
      scheduledMonuments.forEach((monument) => {
        evidence.push(`Real record: scheduled monument "${monument.name}" nearby. Source: ${monument.entityUrl}`);
      });
      listedOrMonumentPenalty += 25;
      policyRefs.push('Ancient Monuments and Archaeological Areas Act 1979');
    }

    if (inConservation) {
      if (conservationAreas.length === 0) {
        evidence.push('Property is flagged as within a conservation area (manually confirmed - no matching planning.data.gov.uk record found for this point).');
      }
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

    score = Math.max(5, score - listedOrMonumentPenalty);
    if (listedOrMonumentPenalty > 0 && decision === 'approve') decision = 'review';
    if (listedOrMonumentPenalty >= 25) decision = 'reject';

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
