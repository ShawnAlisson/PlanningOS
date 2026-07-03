import { NextResponse } from 'next/server';
import { AgentResultsRepository, FinalDecisionsRepository } from '@/lib/repositories';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [results, decision] = await Promise.all([
      AgentResultsRepository.listForApplication(id),
      FinalDecisionsRepository.get(id),
    ]);

    return NextResponse.json({ results, decision });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
