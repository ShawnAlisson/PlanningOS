import { randomUUID } from 'crypto';
import {
  agentResultSchema,
  applicationSchema,
  auditLogSchema,
  finalDecisionSchema,
  extractedDataSchema,
} from '../schemas';
import { Application, AgentResult, AuditLog, FinalDecision } from '../types';
import { hasMongoConfig, getMongoDb } from './mongo';
import { LocalStore, LocalDbShape } from './local';

function sanitizeApplication(app: Partial<Application> & { id?: string }): Application {
  return applicationSchema.parse({
    ...app,
    id: app.id ?? randomUUID(),
    createdAt: app.createdAt ?? new Date().toISOString(),
    updatedAt: app.updatedAt,
    sourceMode: app.sourceMode,
    sourceNote: app.sourceNote,
    fileCount: app.fileCount ?? app.files?.length ?? 0,
    extractedData: app.extractedData ? extractedDataSchema.parse(app.extractedData) : undefined,
  });
}

async function withMongo<T>(fn: (db: Awaited<ReturnType<typeof getMongoDb>>) => Promise<T>): Promise<T> {
  const db = await getMongoDb();
  return fn(db);
}

function withLocal<T>(fn: (db: LocalDbShape) => T): T {
  const db = LocalStore.read();
  return fn(db);
}

export const DbRuntime = {
  hasMongoConfig,

  async listApplications(): Promise<Application[]> {
    if (hasMongoConfig()) {
      return withMongo(async (db) => {
        const docs = await db.collection('applications').find({}).sort({ createdAt: -1 }).toArray();
        const results: Application[] = [];
        for (const doc of docs) {
          const parsed = applicationSchema.safeParse({ ...doc, id: String(doc.id ?? doc._id) });
          if (parsed.success) {
            results.push(parsed.data);
          } else {
            console.warn(`[DbRuntime] Skipped invalid application document ${doc._id || doc.id}:`, parsed.error);
          }
        }
        return results;
      });
    }

    return withLocal((db) => db.applications.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },

  async getApplication(id: string): Promise<Application | undefined> {
    if (hasMongoConfig()) {
      return withMongo(async (db) => {
        const doc = await db.collection('applications').findOne({ id });
        if (!doc) return undefined;
        const parsed = applicationSchema.safeParse({ ...doc, id: String(doc.id ?? id) });
        if (parsed.success) {
          return parsed.data;
        } else {
          console.error(`[DbRuntime] Failed to parse application ${id}:`, parsed.error);
          return undefined;
        }
      });
    }

    return withLocal((db) => db.applications.find((app) => app.id === id));
  },

  async createApplication(app: Omit<Application, 'id' | 'createdAt'> & { id?: string }): Promise<Application> {
    const sanitized = sanitizeApplication(app);

    if (hasMongoConfig()) {
      return withMongo(async (db) => {
        await db.collection('applications').insertOne({
          ...sanitized,
        });
        const inserted = await db.collection('applications').findOne({ id: sanitized.id });
        if (!inserted) {
          throw new Error('Failed to load inserted application');
        }
        return applicationSchema.parse({ ...inserted, id: sanitized.id });
      });
    }

    return withLocal((db) => {
      db.applications.push(sanitized);
      LocalStore.write(db);
      return sanitized;
    });
  },

  async updateApplication(id: string, updates: Partial<Application>): Promise<Application | undefined> {
    if (hasMongoConfig()) {
      return withMongo(async (db) => {
        const patch = {
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        const result = await db.collection('applications').findOneAndUpdate(
          { id },
          { $set: patch },
          { returnDocument: 'after' }
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updated = result && ('value' in result ? (result as any).value : result);
        return updated ? applicationSchema.parse({ ...updated, id: String(updated.id ?? id) }) : undefined;
      });
    }

    return withLocal((db) => {
      const index = db.applications.findIndex((app) => app.id === id);
      if (index === -1) return undefined;
      const updated = {
        ...db.applications[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      db.applications[index] = applicationSchema.parse(updated);
      LocalStore.write(db);
      return db.applications[index];
    });
  },

  async listAgentResults(applicationId: string): Promise<AgentResult[]> {
    if (hasMongoConfig()) {
      return withMongo(async (db) => {
        const docs = await db.collection('agentResults').find({ applicationId }).sort({ createdAt: 1 }).toArray();
        const results: AgentResult[] = [];
        for (const doc of docs) {
          const parsed = agentResultSchema.safeParse(doc);
          if (parsed.success) {
            results.push(parsed.data);
          } else {
            console.warn(`[DbRuntime] Skipped invalid agent result:`, parsed.error);
          }
        }
        return results;
      });
    }

    return withLocal((db) => db.agentResults.filter((row) => row.applicationId === applicationId));
  },

  async upsertAgentResult(result: AgentResult): Promise<AgentResult> {
    const sanitized = agentResultSchema.parse({
      ...result,
      createdAt: result.createdAt ?? new Date().toISOString(),
      contradictions: result.contradictions ?? [],
    });

    if (hasMongoConfig()) {
      return withMongo(async (db) => {
        await db.collection('agentResults').updateOne(
          { applicationId: sanitized.applicationId, agentType: sanitized.agentType },
          { $set: sanitized, $setOnInsert: { createdAt: sanitized.createdAt ?? new Date().toISOString() } },
          { upsert: true }
        );
        return sanitized;
      });
    }

    return withLocal((db) => {
      const index = db.agentResults.findIndex(
        (row) => row.applicationId === sanitized.applicationId && row.agentType === sanitized.agentType
      );
      if (index >= 0) {
        db.agentResults[index] = sanitized;
      } else {
        db.agentResults.push(sanitized);
      }
      LocalStore.write(db);
      return sanitized;
    });
  },

  async getFinalDecision(applicationId: string): Promise<FinalDecision | undefined> {
    if (hasMongoConfig()) {
      return withMongo(async (db) => {
        const doc = await db.collection('finalDecisions').findOne({ applicationId });
        if (!doc) return undefined;
        const parsed = finalDecisionSchema.safeParse(doc);
        if (parsed.success) {
          return parsed.data;
        } else {
          console.error(`[DbRuntime] Failed to parse final decision for ${applicationId}:`, parsed.error);
          return undefined;
        }
      });
    }

    return withLocal((db) => db.finalDecisions.find((row) => row.applicationId === applicationId));
  },

  async upsertFinalDecision(decision: FinalDecision): Promise<FinalDecision> {
    const sanitized = finalDecisionSchema.parse(decision);

    if (hasMongoConfig()) {
      return withMongo(async (db) => {
        await db.collection('finalDecisions').updateOne(
          { applicationId: sanitized.applicationId },
          { $set: sanitized },
          { upsert: true }
        );
        return sanitized;
      });
    }

    return withLocal((db) => {
      const index = db.finalDecisions.findIndex((row) => row.applicationId === sanitized.applicationId);
      if (index >= 0) {
        db.finalDecisions[index] = sanitized;
      } else {
        db.finalDecisions.push(sanitized);
      }
      LocalStore.write(db);
      return sanitized;
    });
  },

  async listAuditLogs(applicationId: string): Promise<AuditLog[]> {
    if (hasMongoConfig()) {
      return withMongo(async (db) => {
        const docs = await db.collection('auditLogs').find({ applicationId }).sort({ timestamp: 1 }).toArray();
        const results: AuditLog[] = [];
        for (const doc of docs) {
          const parsed = auditLogSchema.safeParse(doc);
          if (parsed.success) {
            results.push(parsed.data);
          } else {
            console.warn(`[DbRuntime] Skipped invalid audit log:`, parsed.error);
          }
        }
        return results;
      });
    }

    return withLocal((db) =>
      db.auditLogs.filter((row) => row.applicationId === applicationId).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    );
  },

  async logAudit(entry: Omit<AuditLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): Promise<AuditLog> {
    const auditLog: AuditLog = auditLogSchema.parse({
      ...entry,
      id: entry.id ?? randomUUID(),
      timestamp: entry.timestamp ?? new Date().toISOString(),
    });

    if (hasMongoConfig()) {
      return withMongo(async (db) => {
        await db.collection('auditLogs').insertOne(auditLog);
        return auditLog;
      });
    }

    return withLocal((db) => {
      db.auditLogs.push(auditLog);
      LocalStore.write(db);
      return auditLog;
    });
  },

  async clearApplication(applicationId: string) {
    if (hasMongoConfig()) {
      return withMongo(async (db) => {
        await Promise.all([
          db.collection('agentResults').deleteMany({ applicationId }),
          db.collection('finalDecisions').deleteMany({ applicationId }),
          db.collection('auditLogs').deleteMany({ applicationId }),
        ]);
      });
    }

    return withLocal((db) => {
      db.agentResults = db.agentResults.filter((row) => row.applicationId !== applicationId);
      db.finalDecisions = db.finalDecisions.filter((row) => row.applicationId !== applicationId);
      db.auditLogs = db.auditLogs.filter((row) => row.applicationId !== applicationId);
      LocalStore.write(db);
    });
  },
};
