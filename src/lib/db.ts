import fs from 'fs';
import path from 'path';
import { Application, AgentResult, FinalDecision, AuditLog } from './types';

// Let's store DB file inside the project root at ./data/db.json
const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

interface Schema {
  applications: Application[];
  agentResults: AgentResult[];
  finalDecisions: FinalDecision[];
  auditLogs: AuditLog[];
}

function initializeDb(): Schema {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Error reading local JSON db, reinitializing:', e);
    }
  }

  const initialSchema: Schema = {
    applications: [],
    agentResults: [],
    finalDecisions: [],
    auditLogs: [],
  };

  fs.writeFileSync(DB_FILE, JSON.stringify(initialSchema, null, 2), 'utf8');
  return initialSchema;
}

export function getDb(): Schema {
  return initializeDb();
}

export function saveDb(data: Schema) {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}
