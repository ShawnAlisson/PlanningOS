import { finalDecisionSchema } from '../schemas';
import { Application, AgentResult, FinalDecision } from '../types';

export const AggregationAgent = {
  type: 'aggregation' as const,

  aggregate(app: Application, results: AgentResult[]): FinalDecision {
    if (results.length === 0) {
      return finalDecisionSchema.parse({
        applicationId: app.id,
        overallScore: 0,
        overallConfidence: 0,
        recommendation: 'review',
        summary: 'No agent results were available to aggregate.',
        risks: ['No processing data'],
        suggestedChanges: [],
        contradictions: ['No specialist assessment completed.'],
        updatedAt: new Date().toISOString(),
      });
    }

    const weights: Record<string, number> = {
      policy: 0.3,
      heritage: 0.25,
      flood: 0.15,
      highways: 0.1,
      neighbour: 0.2,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    results.forEach((result) => {
      const weight = weights[result.agentType] ?? 0.1;
      weightedSum += result.score * weight;
      totalWeight += weight;
    });

    const overallScore = Math.round(weightedSum / totalWeight);
    const overallConfidence = Math.round(
      results.reduce((sum, result) => sum + result.confidence, 0) / results.length
    );

    const hasReject = results.some((result) => result.decision === 'reject');
    const hasReview = results.some((result) => result.decision === 'review');

    let recommendation: 'approve' | 'reject' | 'review' = 'approve';
    if (hasReject || overallScore < 60) recommendation = 'reject';
    else if (hasReview || overallScore < 85) recommendation = 'review';

    const risks: string[] = [];
    const suggestedChanges: string[] = [];
    const contradictions = new Set<string>();

    results.forEach((result) => {
      result.contradictions?.forEach((item) => contradictions.add(item));

      if (result.score < 80) {
        if (result.agentType === 'policy') {
          risks.push('Planning policy risk: the proposal is close to or outside the simplified householder thresholds.');
          suggestedChanges.push('Reduce the extension envelope or refine the roof geometry.');
        }
        if (result.agentType === 'heritage') {
          risks.push('Heritage risk: the current design still needs a stronger conservation-area response.');
          suggestedChanges.push('Use context-led materials and show the street-scene response.');
        }
        if (result.agentType === 'flood') {
          risks.push('Flood risk concern: a stronger flood strategy is needed.');
          suggestedChanges.push('Attach a flood assessment and drainage strategy.');
        }
        if (result.agentType === 'highways') {
          risks.push('Highways concern: construction access may need a management condition.');
          suggestedChanges.push('Add a construction logistics note.');
        }
        if (result.agentType === 'neighbour') {
          risks.push('Neighbour amenity risk: massing or openings may affect nearby occupiers.');
          suggestedChanges.push('Reduce bulk near the boundary and clarify side-facing openings.');
        }
      }
    });

    const summary = `This application for "${app.title}" at "${app.address}" has been evaluated by the specialist agents. The current recommendation is ${recommendation.toUpperCase()} with an overall score of ${overallScore}/100.`;

    return finalDecisionSchema.parse({
      applicationId: app.id,
      overallScore,
      overallConfidence,
      recommendation,
      summary,
      risks: Array.from(new Set(risks)),
      suggestedChanges: Array.from(new Set(suggestedChanges)),
      contradictions: Array.from(contradictions),
      updatedAt: new Date().toISOString(),
    });
  },
};
