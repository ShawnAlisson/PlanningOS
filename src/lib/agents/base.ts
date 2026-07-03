import { agentResultSchema } from '../schemas';
import { AgentResult, AgentType, PlanningDecision } from '../types';

export interface AgentInputContext {
  applicationId: string;
  title: string;
  address: string;
  description: string;
  extractedData: NonNullable<import('../types').Application['extractedData']>;
}

export interface PlanningAgent {
  type: AgentType;
  evaluate(input: AgentInputContext): AgentResult;
}

export function buildAgentResult(result: Omit<AgentResult, 'createdAt'> & { createdAt?: string }): AgentResult {
  return agentResultSchema.parse({
    ...result,
    createdAt: result.createdAt ?? new Date().toISOString(),
    contradictions: result.contradictions ?? [],
  });
}

export function normalizeDecision(
  score: number,
  reasonedDecision: PlanningDecision | 'conditional'
): PlanningDecision {
  if (reasonedDecision === 'reject') return 'reject';
  if (reasonedDecision === 'approve' && score < 70) return 'review';
  return reasonedDecision === 'conditional' ? 'review' : reasonedDecision;
}
