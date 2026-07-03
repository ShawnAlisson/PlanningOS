export interface FileRecord {
  name: string;
  url: string;
  size?: number;
  type?: string;
}

export type ApplicationStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type PlanningDecision = 'approve' | 'reject' | 'review';
export type SourceMode = 'demo' | 'manual' | 'upload';

export interface Application {
  id: string;
  title: string;
  address: string;
  description: string;
  files: FileRecord[];
  status: ApplicationStatus;
  createdAt: string;
  updatedAt?: string;
  sourceMode?: SourceMode;
  sourceNote?: string;
  fileCount?: number;
  // Extracted structured data
  extractedData?: {
    propertyType?: string;
    extensionType?: string;
    proposedHeight?: number; // in meters
    proposedVolume?: number; // in m3
    conservationZone?: boolean;
    floodZone?: string; // e.g. "Zone 1", "Zone 2", "Zone 3"
    highwaysProximity?: boolean;
    neighbourImpactLevel?: 'low' | 'medium' | 'high';
  };
}

export type AgentType = 'policy' | 'heritage' | 'flood' | 'highways' | 'neighbour';

export interface AgentResult {
  applicationId: string;
  agentType: AgentType;
  score: number; // 0 - 100
  confidence: number; // 0 - 100
  decision: PlanningDecision;
  reasoning: string;
  evidence: string[];
  policyRefs: string[];
  contradictions?: string[];
  createdAt?: string;
}

export interface FinalDecision {
  applicationId: string;
  overallScore: number;
  overallConfidence: number;
  recommendation: PlanningDecision;
  summary: string;
  risks: string[];
  suggestedChanges: string[];
  contradictions: string[];
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  applicationId: string;
  step: string;
  actor: string; // e.g. "System", "Policy Agent", "Aggregation Agent"
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}
