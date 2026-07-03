import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApplicationsRepository, AuditLogsRepository } from '@/lib/repositories';
import { classifyText } from '@/lib/permissions/classify';

export const runtime = 'nodejs';

const bodySchema = z.object({
  officerNotes: z.string().optional(),
  accessRevoked: z.boolean().optional(),
  temporalUnlockDays: z.number().int().min(0).max(365).optional(),
});

// Simulated case-officer action: write an internal note (classified at write
// time - may use an LLM, see classify.ts), or flip the "revoke access" kill
// switch used to demo lineage-based propagation to derived agent memory.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await req.json());
    const application = await ApplicationsRepository.get(id);
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    if (body.officerNotes !== undefined) {
      const classification = body.officerNotes.trim()
        ? await classifyText(body.officerNotes, { context: 'Case officer internal note' }).then((c) => (c === 'public' ? 'internal' : c))
        : 'public';
      updates.officerNotes = body.officerNotes;
      updates.fieldClassification = { ...application.fieldClassification, officerNotes: classification };
    }

    if (body.accessRevoked !== undefined) {
      updates.accessRevoked = body.accessRevoked;
    }

    if (body.temporalUnlockDays !== undefined) {
      updates.temporalUnlockDays = body.temporalUnlockDays;
    }

    const updated = await ApplicationsRepository.update(id, updates);

    await AuditLogsRepository.log(id, 'officer-action', 'case-officer', body.accessRevoked !== undefined
      ? `Case officer ${body.accessRevoked ? 'revoked' : 'restored'} access to this application and its derived records.`
      : 'Case officer updated internal notes.', { updates: Object.keys(updates) });

    return NextResponse.json({ application: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
