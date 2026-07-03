import { NextResponse } from 'next/server';
import { ApplicationsRepository } from '@/lib/repositories';
import { createApplicationSchema } from '@/lib/schemas';

export async function GET() {
  try {
    const list = await ApplicationsRepository.list();
    return NextResponse.json(list);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createApplicationSchema.parse(body);
    const newApp = await ApplicationsRepository.create({
      ...parsed,
      status: 'pending',
      fileCount: parsed.files.length,
    });

    return NextResponse.json(newApp, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
