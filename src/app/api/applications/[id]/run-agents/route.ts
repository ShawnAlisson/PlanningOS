import { NextResponse } from 'next/server';
import { Orchestrator } from '@/lib/agents/orchestrator';

export const runtime = 'nodejs';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const outcome = await Orchestrator.runPipeline(id);
    return NextResponse.json(outcome);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
