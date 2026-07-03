import { NextResponse } from 'next/server';
import { ApplicationsRepository } from '@/lib/repositories';
import { createApplicationSchema } from '@/lib/schemas';
import { saveUploadedFiles } from '@/lib/storage/blob';
import { classifyApplicationFields } from '@/lib/permissions/classify';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds on Vercel


async function readRequestBody(req: Request) {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const metadata = form.get('metadata');
    const parsed = metadata ? JSON.parse(String(metadata)) : {};
    const files = form
      .getAll('files')
      .filter((item): item is File => item instanceof File);
    const storedFiles = await saveUploadedFiles(files, parsed.filesMetadata);

    return {
      ...parsed,
      files: storedFiles,
    };
  }

  return req.json();
}

export async function POST(req: Request) {
  try {
    const body = await readRequestBody(req);
    const parsed = createApplicationSchema.parse(body);
    const fieldClassification = await classifyApplicationFields(parsed);
    const created = await ApplicationsRepository.create({
      ...parsed,
      status: 'pending',
      fileCount: parsed.files.length,
      fieldClassification,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    console.error('[Upload API Exception]:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
