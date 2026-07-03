import { NextResponse } from 'next/server';
import { Orchestrator } from '@/lib/agents/orchestrator';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Run the pipeline asynchronously or synchronously. Since we want immediate responses in Next.js development servers,
    // we can await it here, or run it in the background. In Next.js, awaiting it is extremely robust and avoids connection terminations.
    const outcome = await Orchestrator.runPipeline(id);

    return NextResponse.json(outcome);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
