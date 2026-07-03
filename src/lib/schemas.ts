import { z } from 'zod';

export const fileRecordSchema = z.object({
  name: z.string().min(1),
  url: z.string().min(1),
  size: z.number().int().nonnegative().optional(),
  type: z.string().optional(),
});

export const applicationStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);
export const planningDecisionSchema = z.enum(['approve', 'reject', 'review']);
export const sourceModeSchema = z.enum(['demo', 'manual', 'upload']).optional();
export const agentTypeSchema = z.enum(['policy', 'heritage', 'flood', 'highways', 'neighbour']);

const legacyDecisionNormalizer = z.preprocess((value) => {
  if (value === 'conditional') return 'review';
  if (value === 'refuse') return 'reject';
  return value;
}, planningDecisionSchema);

export const extractedDataSchema = z.object({
  propertyType: z.string().optional(),
  extensionType: z.string().optional(),
  proposedHeight: z.number().nonnegative().optional(),
  proposedVolume: z.number().nonnegative().optional(),
  conservationZone: z.boolean().optional(),
  floodZone: z.string().optional(),
  highwaysProximity: z.boolean().optional(),
  neighbourImpactLevel: z.enum(['low', 'medium', 'high']).optional(),
  boundaryDistance: z.number().nonnegative().optional(),
  originalHouseWidth: z.number().nonnegative().optional(),
});

export const applicationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  address: z.string().min(1),
  description: z.string().min(1),
  files: z.array(fileRecordSchema),
  status: applicationStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  sourceMode: sourceModeSchema,
  sourceNote: z.string().optional(),
  fileCount: z.number().int().nonnegative().optional(),
  extractedData: extractedDataSchema.optional(),
});

export const agentResultSchema = z.object({
  applicationId: z.string().min(1),
  agentType: agentTypeSchema,
  score: z.number().int().min(0).max(100),
  confidence: z.number().int().min(0).max(100).default(70),
  decision: legacyDecisionNormalizer,
  reasoning: z.string().min(1),
  evidence: z.array(z.string()),
  policyRefs: z.array(z.string()),
  contradictions: z.array(z.string()).default([]),
  createdAt: z.string().datetime().optional(),
});

export const finalDecisionSchema = z.object({
  applicationId: z.string().min(1),
  overallScore: z.number().int().min(0).max(100),
  overallConfidence: z.number().int().min(0).max(100).default(70),
  recommendation: legacyDecisionNormalizer,
  summary: z.string().min(1),
  risks: z.array(z.string()),
  suggestedChanges: z.array(z.string()),
  contradictions: z.array(z.string()).default([]),
  updatedAt: z.string().datetime().default(() => new Date().toISOString()),
});

export const auditLogSchema = z.object({
  id: z.string().min(1),
  applicationId: z.string().min(1),
  step: z.string().min(1),
  actor: z.string().min(1),
  message: z.string().min(1),
  timestamp: z.string().datetime(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const createApplicationSchema = z.object({
  title: z.string().min(1),
  address: z.string().min(1),
  description: z.string().min(1),
  files: z.array(fileRecordSchema).default([]),
  sourceMode: sourceModeSchema,
  sourceNote: z.string().optional(),
  extractedData: extractedDataSchema.optional(),
});

export const runAgentsInputSchema = z.object({
  extractFromDocuments: z.boolean().default(true),
});

export type ApplicationInput = z.infer<typeof createApplicationSchema>;
export type ExtractedData = z.infer<typeof extractedDataSchema>;
export type PlanningDecisionValue = z.infer<typeof planningDecisionSchema>;
