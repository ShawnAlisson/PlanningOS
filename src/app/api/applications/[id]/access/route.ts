import { NextResponse } from 'next/server';
import {
  ApplicationsRepository,
  AgentResultsRepository,
  FinalDecisionsRepository,
  AuditLogsRepository,
} from '@/lib/repositories';
import { buildRedactedView } from '@/lib/permissions/gate';
import type { Role } from '@/lib/permissions/types';

export const runtime = 'nodejs';

const VALID_ROLES: Role[] = ['public', 'applicant', 'case-officer', 'auditor'];

// Role-aware read path for the permission-aware memory layer demo. This is
// the ONLY place the UI should read a role-scoped view of an application:
// every field visible here was cleared by the deterministic gate in
// src/lib/permissions/gate.ts, and every check was logged to the audit trail.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const roleParam = (searchParams.get('role') || 'public') as Role;
    const role = VALID_ROLES.includes(roleParam) ? roleParam : 'public';
    const asOfParam = searchParams.get('asOf');
    const asOf = asOfParam ? new Date(asOfParam) : undefined;

    const application = await ApplicationsRepository.get(id);
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const [results, decision, audit] = await Promise.all([
      AgentResultsRepository.listForApplication(id),
      FinalDecisionsRepository.get(id),
      AuditLogsRepository.listForApplication(id),
    ]);

    const view = await buildRedactedView({ role, application, results, decision, audit, asOf });

    return NextResponse.json({
      role,
      asOf: (asOf || new Date()).toISOString(),
      ...view,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
