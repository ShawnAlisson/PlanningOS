import { NextResponse } from 'next/server';
import { AuditLogsRepository } from '@/lib/repositories';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const audit = await AuditLogsRepository.listForApplication(id);
    return NextResponse.json({ audit });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
