import { DbRuntime } from './db/runtime';
import { Application, AgentResult, FinalDecision, AuditLog } from './types';

export const ApplicationsRepository = {
  list(): Promise<Application[]> {
    return DbRuntime.listApplications();
  },

  get(id: string): Promise<Application | undefined> {
    return DbRuntime.getApplication(id);
  },

  create(app: Omit<Application, 'id' | 'createdAt'> & { id?: string }): Promise<Application> {
    return DbRuntime.createApplication(app);
  },

  update(id: string, updates: Partial<Application>): Promise<Application | undefined> {
    return DbRuntime.updateApplication(id, updates);
  },
};

export const AgentResultsRepository = {
  listForApplication(applicationId: string): Promise<AgentResult[]> {
    return DbRuntime.listAgentResults(applicationId);
  },

  upsert(result: AgentResult): Promise<AgentResult> {
    return DbRuntime.upsertAgentResult(result);
  },
};

export const FinalDecisionsRepository = {
  get(applicationId: string): Promise<FinalDecision | undefined> {
    return DbRuntime.getFinalDecision(applicationId);
  },

  upsert(decision: FinalDecision): Promise<FinalDecision> {
    return DbRuntime.upsertFinalDecision(decision);
  },
};

export const AuditLogsRepository = {
  listForApplication(applicationId: string): Promise<AuditLog[]> {
    return DbRuntime.listAuditLogs(applicationId);
  },

  log(applicationId: string, step: string, actor: string, message: string, details?: Record<string, unknown>): Promise<AuditLog> {
    return DbRuntime.logAudit({
      applicationId,
      step,
      actor,
      message,
      details,
    });
  },

  clear(applicationId: string) {
    return DbRuntime.clearApplication(applicationId);
  },
};
