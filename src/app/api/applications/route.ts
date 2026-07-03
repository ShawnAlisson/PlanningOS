import { NextResponse } from 'next/server';
import { ApplicationsRepository } from '@/lib/repositories';
import { createApplicationSchema } from '@/lib/schemas';
import { classifyApplicationFields } from '@/lib/permissions/classify';

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
    const fieldClassification = await classifyApplicationFields(parsed);
    const newApp = await ApplicationsRepository.create({
      ...parsed,
      status: 'pending',
      fileCount: parsed.files.length,
      fieldClassification,
    });

    return NextResponse.json(newApp, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
