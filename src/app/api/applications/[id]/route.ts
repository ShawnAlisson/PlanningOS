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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await ApplicationsRepository.get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // Deep merge extractedData to protect other properties (propertyType, conservationZone, floodZone, etc.)
    const mergedExtractedData = body.extractedData 
      ? {
          ...(existing.extractedData || {}),
          ...body.extractedData,
          footprint: body.extractedData.footprint 
            ? {
                ...(existing.extractedData?.footprint || {}),
                ...body.extractedData.footprint,
              }
            : existing.extractedData?.footprint,
        }
      : existing.extractedData;

    const updates = {
      ...body,
      extractedData: mergedExtractedData,
    };

    const updated = await ApplicationsRepository.update(id, updates);

    // Append to audit log
    await AuditLogsRepository.log(
      id,
      'geometry_update',
      'user',
      `Manual 3D massing model adjustments saved (Height: ${mergedExtractedData?.proposedHeight}m, Footprint: ${mergedExtractedData?.footprint?.widthM}m x ${mergedExtractedData?.footprint?.depthM}m, Rotation: ${mergedExtractedData?.footprint?.rotationDeg ?? 0}deg).`
    );

    return NextResponse.json({ application: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
