import { UK_PLANNING_SOURCES } from '../uk-sources';
import { AgentInputContext, buildAgentResult } from './base';

export const PolicyAgent = {
  type: 'policy' as const,

  evaluate(input: AgentInputContext) {
    const data = input.extractedData || {};
    const proposedHeight = data.proposedHeight ?? 3;
    const proposedVolume = data.proposedVolume ?? 30;
    const extensionType = data.extensionType || 'rear';
    const propertyType = (data.propertyType || '').toLowerCase();
    const isTerraced = propertyType.includes('terraced');
    const isSemiOrDetached = propertyType.includes('semi') || propertyType.includes('detached');
    const loftVolumeLimit = isTerraced ? 40 : isSemiOrDetached ? 50 : 40;
    const article4Areas = input.siteConstraints?.article4Directions || [];
    const greenBelt = input.siteConstraints?.greenBelt || [];

    let score = 95;
    let decision: 'approve' | 'reject' | 'review' = 'approve';
    const evidence: string[] = [];
    const policyRefs: string[] = [UK_PLANNING_SOURCES.permittedDevelopment.reference];

    evidence.push(`Extension type: ${extensionType}.`);
    evidence.push(`Proposed height: ${proposedHeight}m.`);
    evidence.push(`Proposed volume: ${proposedVolume}m³.`);

    if (article4Areas.length > 0) {
      article4Areas.forEach((area) => {
        evidence.push(`Real record: Article 4 direction "${area.name}" removes some permitted development rights here. Source: ${area.entityUrl}`);
      });
      score -= 30;
      policyRefs.push('Town and Country Planning Act 1990, section 4 (Article 4 direction)');
      evidence.push('Because permitted development rights are withdrawn by this Article 4 direction, a full householder planning application is required rather than a PD notification.');
    }

    if (greenBelt.length > 0) {
      greenBelt.forEach((area) => {
        evidence.push(`Real record: site falls within the "${area.name}" Green Belt designation. Source: ${area.entityUrl}`);
      });
      score -= 15;
      policyRefs.push('NPPF, chapter 13 (Green Belt)');
    }

    if (extensionType === 'loft') {
      evidence.push(`Roof extension volume threshold used for this property type: ${loftVolumeLimit}m³.`);

      if (proposedVolume > loftVolumeLimit) {
        score -= 30;
        decision = 'review';
        evidence.push(`Roof enlargement of ${proposedVolume}m³ exceeds the usual ${loftVolumeLimit}m³ threshold.`);
        policyRefs.push('Schedule 2, Part 1, Class B');
      } else {
        evidence.push(`Roof enlargement of ${proposedVolume}m³ stays within the usual ${loftVolumeLimit}m³ threshold.`);
      }

      if (proposedHeight > 4) {
        score -= 15;
        decision = 'review';
        evidence.push(`Roof profile at ${proposedHeight}m may need refinement if it alters the ridge line significantly.`);
      }
    } else if (extensionType === 'rear' || extensionType === 'side') {
      evidence.push('Rear/side extension check uses simplified householder thresholds for the MVP.');

      if (proposedHeight > 4) {
        score -= 35;
        decision = 'review';
        evidence.push(`Height of ${proposedHeight}m exceeds the usual 4m single-storey envelope.`);
        policyRefs.push('Schedule 2, Part 1, Class A');
      } else {
        evidence.push(`Height of ${proposedHeight}m sits within a typical single-storey envelope.`);
      }
    } else {
      score = 60;
      decision = 'review';
      evidence.push('Non-standard extension or new build. Full planning review is required.');
      policyRefs.push('General householder development guidance');
    }

    if (article4Areas.length > 0 && decision === 'approve') decision = 'review';
    if (article4Areas.length > 0 && score < 60) decision = 'reject';
    score = Math.max(5, score);

    const confidence = Math.max(45, Math.min(98, score));

    return buildAgentResult({
      applicationId: input.applicationId,
      agentType: 'policy',
      score,
      confidence,
      decision,
      reasoning:
        decision === 'approve'
          ? `The proposal broadly aligns with permitted development rights under the simplified checks used by this MVP.`
          : `The proposal needs design adjustments or a fuller review because one or more planning limits are close to or beyond the simplified thresholds used here.`,
      evidence,
      policyRefs,
      contradictions: [],
      evidenceQuality: input.extractedData?.footprint ? 'parsed-dxf' : 'heuristic',
    });
  },
};
