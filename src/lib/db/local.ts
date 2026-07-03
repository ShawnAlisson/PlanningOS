import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import {
  agentResultSchema,
  applicationSchema,
  auditLogSchema,
  finalDecisionSchema,
} from '../schemas';
import { Application, AgentResult, AuditLog, FinalDecision } from '../types';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

const localSchema = z.object({
  applications: z.array(applicationSchema),
  agentResults: z.array(agentResultSchema),
  finalDecisions: z.array(finalDecisionSchema),
  auditLogs: z.array(auditLogSchema),
});

export interface LocalDbShape {
  applications: Application[];
  agentResults: AgentResult[];
  finalDecisions: FinalDecision[];
  auditLogs: AuditLog[];
}

const inMemoryDb = (): LocalDbShape => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = global as any;
  if (!g._inMemoryDb) {
    g._inMemoryDb = {
      applications: [],
      agentResults: [],
      finalDecisions: [],
      auditLogs: [],
    };
  }
  return g._inMemoryDb;
};

function readLocalDb(): LocalDbShape {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = global as any;
  if (g._inMemoryDb) {
    return g._inMemoryDb;
  }

  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
      const initial: LocalDbShape = {
        applications: [],
        agentResults: [],
        finalDecisions: [],
        auditLogs: [],
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }

    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return localSchema.parse(parsed);
  } catch (err) {
    console.warn('Local file DB read failed, using global in-memory DB:', err);
    return inMemoryDb();
  }
}

function writeLocalDb(data: LocalDbShape) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = global as any;
  g._inMemoryDb = data;

  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('Local file DB write failed, fallback to in-memory DB:', err);
  }
}

export const LocalStore = {
  read: readLocalDb,
  write: writeLocalDb,
};

