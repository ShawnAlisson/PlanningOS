import { ApplicationsRepository, AgentResultsRepository, FinalDecisionsRepository, AuditLogsRepository } from '../repositories';
import { extractStructuredData } from '../services/extraction';
import { resolveSiteContext } from '../services/geo';
import { Application, AgentResult, FinalDecision } from '../types';
import { AggregationAgent } from './aggregator';
import { FloodRiskAgent } from './flood';
import { HeritageAgent } from './heritage';
import { HighwaysAgent } from './highways';
import { NeighbourImpactAgent } from './neighbour';
import { PolicyAgent } from './policy';
import { AgentInputContext } from './base';

const agentList = [PolicyAgent, HeritageAgent, FloodRiskAgent, HighwaysAgent, NeighbourImpactAgent] as const;

export const Orchestrator = {
  async runPipeline(applicationId: string): Promise<{
    application: Application;
    results: AgentResult[];
    decision: FinalDecision;
  }> {
    const initial = await ApplicationsRepository.get(applicationId);
    if (!initial) {
      throw new Error(`Application ${applicationId} not found`);
    }

    await ApplicationsRepository.update(applicationId, { status: 'processing' });
    await AuditLogsRepository.clear(applicationId);
    await AuditLogsRepository.log(applicationId, 'pipeline', 'system', 'Pipeline started', {
      stage: 'initialization',
    });

    try {
      const geocoded = initial.geo && initial.siteConstraints ? initial : await this.geocode(applicationId, initial);
      const applicationWithExtraction = await this.extract(applicationId, geocoded);

      await AuditLogsRepository.log(applicationId, 'pipeline', 'system', 'Launching specialist agents', {
        agents: agentList.map((agent) => agent.type),
      });

      const agentInput = this.buildAgentInput(applicationWithExtraction);
      const settled = await Promise.allSettled(
        agentList.map(async (agent) => {
          await AuditLogsRepository.log(applicationId, 'agent-started', `${agent.type}-agent`, 'Agent started', {
            agentType: agent.type,
          });

          const result = agent.evaluate(agentInput);
          const persisted = await AgentResultsRepository.upsert(result);

          await AuditLogsRepository.log(applicationId, 'agent-completed', `${agent.type}-agent`, 'Agent completed', {
            agentType: agent.type,
            score: persisted.score,
            decision: persisted.decision,
            confidence: persisted.confidence,
          });

          return persisted;
        })
      );

      const results = settled
        .filter((entry): entry is PromiseFulfilledResult<AgentResult> => entry.status === 'fulfilled')
        .map((entry) => entry.value);

      const failedAgents = settled
        .map((entry, index) => ({ entry, agent: agentList[index] }))
        .filter((item): item is { entry: PromiseRejectedResult; agent: (typeof agentList)[number] } => item.entry.status === 'rejected');

      for (const failed of failedAgents) {
        const errorMsg = failed.entry.reason instanceof Error ? failed.entry.reason.message : String(failed.entry.reason);
        await AuditLogsRepository.log(applicationId, 'agent-failed', `${failed.agent.type}-agent`, `Agent failed: ${errorMsg}`, {
          agentType: failed.agent.type,
          error: errorMsg,
        });
      }

      await AuditLogsRepository.log(applicationId, 'aggregation-started', 'aggregation-agent', 'Aggregation started', {
        resultCount: results.length,
        failedCount: failedAgents.length,
      });

      const finalDecision = AggregationAgent.aggregate(applicationWithExtraction, results);
      const storedDecision = await FinalDecisionsRepository.upsert(finalDecision);

      const completedApplication = await ApplicationsRepository.update(applicationId, {
        status: results.length > 0 ? 'completed' : 'failed',
        updatedAt: new Date().toISOString(),
      });

      await AuditLogsRepository.log(applicationId, 'final-decision', 'aggregation-agent', 'Final decision created', {
        recommendation: storedDecision.recommendation,
        overallScore: storedDecision.overallScore,
        overallConfidence: storedDecision.overallConfidence,
        failedAgents: failedAgents.map((item) => item.agent.type),
      });

      return {
        application: completedApplication || applicationWithExtraction,
        results,
        decision: storedDecision,
      };
    } catch (pipelineError: unknown) {
      const errorMsg = pipelineError instanceof Error ? pipelineError.message : String(pipelineError);
      
      await ApplicationsRepository.update(applicationId, {
        status: 'failed',
        updatedAt: new Date().toISOString(),
      });

      await AuditLogsRepository.log(applicationId, 'pipeline-failed', 'system', `Pipeline failed: ${errorMsg}`, {
        error: errorMsg,
      });

      throw pipelineError;
    }
  },

  async geocode(applicationId: string, app: Application): Promise<Application> {
    await AuditLogsRepository.log(applicationId, 'geocoding', 'system', 'Resolving site location and UK planning constraints', {
      provider: 'postcodes.io + planning.data.gov.uk',
    });

    const { geo, siteConstraints } = await resolveSiteContext(app.address);

    const updated = await ApplicationsRepository.update(applicationId, {
      geo: geo || undefined,
      siteConstraints,
      updatedAt: new Date().toISOString(),
    });

    await AuditLogsRepository.log(
      applicationId,
      'geocoding',
      'system',
      geo
        ? `Resolved to ${geo.postcode} (${geo.adminDistrict || 'unknown authority'}). Found ${siteConstraints?.totalConstraints ?? 0} real planning constraint record(s).`
        : 'Could not resolve a UK postcode from the address; falling back to manual/heuristic site facts.',
      { geo, totalConstraints: siteConstraints?.totalConstraints ?? 0 }
    );

    return updated || { ...app, geo: geo || undefined, siteConstraints };
  },

  async extract(applicationId: string, app: Application): Promise<Application> {
    await AuditLogsRepository.log(applicationId, 'extraction', 'system', 'Structured extraction started');

    const extractedData = await extractStructuredData({
      title: app.title,
      address: app.address,
      description: app.description,
      files: app.files,
      sourceMode: app.sourceMode,
      sourceNote: app.sourceNote,
      extractedData: app.extractedData,
      siteConstraints: app.siteConstraints,
    });

    const updated = await ApplicationsRepository.update(applicationId, {
      extractedData,
      status: 'processing',
      updatedAt: new Date().toISOString(),
    });

    await AuditLogsRepository.log(applicationId, 'extraction', 'system', 'Structured extraction completed', {
      extractedData,
    });

    return updated || { ...app, extractedData };
  },

  buildAgentInput(app: Application): AgentInputContext {
    return {
      applicationId: app.id,
      title: app.title,
      address: app.address,
      description: app.description,
      extractedData: app.extractedData || {},
      siteConstraints: app.siteConstraints,
    };
  },
};
