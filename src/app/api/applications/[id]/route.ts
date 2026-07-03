import { NextResponse } from 'next/server';
import {
  ApplicationsRepository,
  AgentResultsRepository,
  FinalDecisionsRepository,
  AuditLogsRepository,
} from '@/lib/repositories';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const application = await ApplicationsRepository.get(id);

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const [results, decision, logs] = await Promise.all([
      AgentResultsRepository.listForApplication(id),
      FinalDecisionsRepository.get(id),
      AuditLogsRepository.listForApplication(id),
    ]);

    return NextResponse.json({
      application,
      results,
      decision,
      logs,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
