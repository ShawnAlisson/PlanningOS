/**
 * PlanningOS Permission-Aware Memory Layer
 * ==========================================
 * Inspired by the "Based AI" hackathon track: a memory/data layer that stays
 * synchronised with source access rules, enforces access deterministically at
 * the retrieval layer (no LLM call on the read path), governs derived data by
 * lineage, and produces an auditable decision log with sub-200ms latency.
 *
 * Design in this codebase:
 *  - `Application` is the single source of truth. It carries per-field
 *    classifications (public / restricted / internal / personal) that are
 *    assigned at WRITE time (see classify.ts — may use an LLM there).
 *  - `AgentResult` / `FinalDecision` / `AuditLog` are DERIVED memory. They do
 *    not store their own ACL. Every read resolves access by following
 *    lineage back to the source Application's *current* classification -
 *    so revoking/redacting the source instantly and correctly propagates to
 *    every derivative, with no cache to invalidate.
 *  - The enforcement function (`evaluateAccess` in gate.ts) is a pure,
 *    synchronous rule table. It never calls an LLM or network. That keeps the
 *    P99 well under 200ms (typically sub-millisecond, see logged latencyMs).
 */

export type Role = 'public' | 'applicant' | 'case-officer' | 'auditor';

export type DataClassification = 'public' | 'restricted' | 'internal' | 'personal';

export type ProtectedField =
  | 'summary'
  | 'agentReasoning'
  | 'applicantContact'
  | 'officerNotes'
  | 'auditTrail'
  | 'rawEvidence';

export interface AccessDecision {
  allow: boolean;
  role: Role;
  field: ProtectedField;
  classification: DataClassification;
  reason: string;
  ruleId: string;
  latencyMs: number;
  asOf: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  public: 'Public / third party',
  applicant: 'Applicant',
  'case-officer': 'Council case officer',
  auditor: 'Compliance auditor',
};

export const DEFAULT_TEMPORAL_UNLOCK_DAYS = 30;
