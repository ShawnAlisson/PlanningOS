import { AgentResultsRepository, ApplicationsRepository, AuditLogsRepository } from '../repositories';
import { Orchestrator } from '../agents/orchestrator';
import { fetchAiChatRequestSchema, FetchAiChatRequest, FetchAiChatResponse, fetchAiChatResponseSchema } from './protocol';

function needsMoreDetails(input: FetchAiChatRequest) {
  return !input.applicationId && (!input.title || !input.address || !input.description);
}

export async function handleFetchAiChat(rawInput: unknown): Promise<FetchAiChatResponse> {
  const input = fetchAiChatRequestSchema.parse(rawInput);

  if (needsMoreDetails(input)) {
    return fetchAiChatResponseSchema.parse({
      reply:
        'Please provide a title, address, and description for the planning proposal, or include an applicationId if you want me to check an existing case.',
      status: 'needs_details',
      nextSteps: ['Share the planning proposal title', 'Share the site address', 'Share a short description of the works'],
    });
  }

  if (input.applicationId) {
    const [application, results, audit] = await Promise.all([
      ApplicationsRepository.get(input.applicationId),
      AgentResultsRepository.listForApplication(input.applicationId),
      AuditLogsRepository.listForApplication(input.applicationId),
    ]);

    if (!application) {
      return fetchAiChatResponseSchema.parse({
        reply: `I could not find application ${input.applicationId}. Please share a new submission or a valid application id.`,
        status: 'failed',
        nextSteps: ['Submit a new application', 'Check the application ID'],
      });
    }

    if (application.status === 'completed' || results.length > 0) {
      return fetchAiChatResponseSchema.parse({
        reply: `I found ${application.title}. The review has already been completed, and I can summarise the outcome on request.`,
        status: 'completed',
        applicationId: application.id,
        application,
        results,
        nextSteps: ['Ask for a summary', 'Ask for the strongest objections', 'Ask for the supporting policy references'],
      });
    }

    await AuditLogsRepository.log(application.id, 'agent-chat', 'fetch.ai bridge', 'Chat request received for an existing application', {
      auditCount: audit.length,
    });

    const outcome = await Orchestrator.runPipeline(application.id);
    return fetchAiChatResponseSchema.parse({
      reply: `I ran the planning agents for ${application.title}. The recommendation is ${outcome.decision.recommendation.toUpperCase()} with an overall score of ${outcome.decision.overallScore}/100.`,
      status: 'completed',
      applicationId: outcome.application.id,
      application: outcome.application,
      results: outcome.results,
      nextSteps: ['Open the review screen', 'Inspect the agent breakdown', 'Review the audit trail'],
    });
  }

  const created = await ApplicationsRepository.create({
    title: input.title!,
    address: input.address!,
    description: input.description!,
    files: (input.files || []).map((file) => ({
      name: file.name,
      url: file.url || '#',
      size: file.size,
      type: file.type,
    })),
    sourceMode: 'upload',
    sourceNote: 'Submitted via Fetch.ai agent bridge.',
    extractedData: input.extractedData,
    status: 'pending',
    fileCount: input.files?.length || 0,
  });

  await AuditLogsRepository.log(created.id, 'agent-chat', 'fetch.ai bridge', 'Application created from agent conversation');
  const outcome = await Orchestrator.runPipeline(created.id);

  return fetchAiChatResponseSchema.parse({
    reply: `I created and analysed the application "${created.title}". The recommendation is ${outcome.decision.recommendation.toUpperCase()} with an overall score of ${outcome.decision.overallScore}/100.`,
    status: 'completed',
    applicationId: created.id,
    application: outcome.application,
    results: outcome.results,
    nextSteps: ['Share the review link', 'Ask for the top objections', 'Request the audit log'],
  });
}
