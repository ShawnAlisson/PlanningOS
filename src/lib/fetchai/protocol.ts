import { z } from 'zod';
import { agentResultSchema, applicationSchema, extractedDataSchema } from '../schemas';

export const fetchAiChatRequestSchema = z.object({
  message: z.string().min(1),
  applicationId: z.string().optional(),
  title: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
  files: z.array(z.object({
    name: z.string(),
    url: z.string().optional(),
    size: z.number().optional(),
    type: z.string().optional(),
  })).optional(),
  extractedData: extractedDataSchema.optional(),
});

export const fetchAiChatResponseSchema = z.object({
  reply: z.string(),
  status: z.enum(['needs_details', 'created', 'running', 'completed', 'failed']),
  applicationId: z.string().optional(),
  application: applicationSchema.optional(),
  results: z.array(agentResultSchema).optional(),
  nextSteps: z.array(z.string()).default([]),
});

export type FetchAiChatRequest = z.infer<typeof fetchAiChatRequestSchema>;
export type FetchAiChatResponse = z.infer<typeof fetchAiChatResponseSchema>;

export const agentverseTags = [
  'innovationlab',
  'hackathon',
  'planning',
  'uk',
  'compliance',
];

export const agentMetadata = {
  name: 'PlanningOS UK Planning Agent',
  description: 'A multi-agent planning assistant that triages UK householder applications with explainable policy, heritage, flood, highways, and neighbour checks.',
  protocol: 'agent-chat',
  tags: agentverseTags,
};
