import { extractedDataSchema, type ApplicationInput, type ExtractedData } from '../schemas';
import { getStoredNameFromUrl, readStoredBlob } from '../storage/blob';
import { isLlmConfigured, chatCompletion } from '../llm/client';
import { derivedFloodZoneLabel, type SiteConstraints } from './planningData';
import { parseDxfFootprint } from './dxf';

function isImageFile(fileName: string, mimeType?: string) {
  return (
    Boolean(mimeType && mimeType.startsWith('image/')) ||
    /\.(png|jpg|jpeg|webp)$/i.test(fileName)
  );
}

function isDxfFile(fileName: string) {
  return /\.dxf$/i.test(fileName);
}

/**
 * Local models that don't support a strict json_object response_format (see
 * src/lib/llm/client.ts fallback) often wrap their JSON in ```json fences or
 * add a sentence before/after it. Strip that so JSON.parse still succeeds.
 */
function extractJsonPayload(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const braceMatch = content.match(/\{[\s\S]*\}/);
  return braceMatch ? braceMatch[0] : content;
}

/**
 * Real footprint from an uploaded DXF drawing. Binary .dwg files cannot be
 * parsed by any reliable open-source library, so they are stored as evidence
 * only - only .dxf (the open, text-based CAD interchange format that AutoCAD,
 * LibreCAD, QCAD, Revit, FreeCAD, etc. can all export) produces real geometry.
 */
async function extractDxfFootprint(input: ApplicationInput): Promise<ExtractedData['footprint']> {
  const dxfFile = input.files.find((file) => isDxfFile(file.name) && file.url);
  if (!dxfFile?.url) return undefined;

  try {
    const storedName = getStoredNameFromUrl(dxfFile.url);
    if (!storedName) return undefined;
    const { data } = await readStoredBlob(storedName);
    return parseDxfFootprint(data.toString('utf8')) || undefined;
  } catch (error) {
    console.warn('DXF footprint extraction failed:', error);
    return undefined;
  }
}

function deterministicExtractFromText(input: ApplicationInput): ExtractedData {
  const text = `${input.title} ${input.address} ${input.description}`.toLowerCase();

  const propertyType =
    text.includes('terrace') || text.includes('terraced')
      ? 'Terraced'
      : text.includes('detached')
      ? 'Detached'
      : text.includes('semi')
      ? 'Semi-detached'
      : text.includes('flat') || text.includes('apartment')
      ? 'Flat/Apartment'
      : 'Semi-detached';

  const extensionType =
    text.includes('loft') || text.includes('roof') ? 'loft' : text.includes('side') ? 'side' : 'rear';

  const proposedHeight = text.includes('two storey') || text.includes('two-storey') ? 5 : text.includes('single storey') ? 3.2 : 2.8;
  const proposedVolume = text.includes('large') ? 48 : text.includes('dormer') ? 38 : 30;

  return {
    propertyType,
    extensionType,
    proposedHeight,
    proposedVolume,
    highwaysProximity: text.includes('highway') || text.includes('main road'),
    neighbourImpactLevel: text.includes('overlooking') || text.includes('overbear') ? 'high' : text.includes('privacy') ? 'medium' : 'low',
  };
}

/** Project-specific fields (what is being built) can only come from the description/drawings, never from the postcode. */
async function llmExtractProjectDetails(input: ApplicationInput): Promise<Partial<ExtractedData>> {
  if (!isLlmConfigured()) {
    return {};
  }

  try {
    const imageFile = input.files.find((file) => isImageFile(file.name, file.type) && file.url);
    let imagePayload: string | undefined;
    const imageMime = imageFile?.type || 'image/png';

    if (imageFile?.url) {
      const storedName = getStoredNameFromUrl(imageFile.url);
      if (storedName) {
        const { data } = await readStoredBlob(storedName);
        imagePayload = `data:${imageMime};base64,${data.toString('base64')}`;
      }
    }

    const content = await chatCompletion(
      [
        {
          role: 'system',
          content:
            'You analyse UK householder planning proposals. Extract ONLY project-specific fields from the text/drawing: propertyType, extensionType (loft|rear|side|new-build), proposedHeight (metres), proposedVolume (m3), neighbourImpactLevel (low|medium|high), boundaryDistance (metres), originalHouseWidth (metres). Do not guess flood zone, conservation area or highway data - that comes from official records, not from you. Return strict JSON with only the fields you are confident about.',
        },
        {
          role: 'user',
          content: imagePayload
            ? [
                { type: 'text', text: `Title: ${input.title}\nDescription: ${input.description}\n\nInspect the attached drawing/photo for massing, height, and materials cues.` },
                { type: 'image_url', image_url: { url: imagePayload } },
              ]
            : `Title: ${input.title}\nAddress: ${input.address}\nDescription: ${input.description}`,
        },
      ],
      { jsonMode: true }
    );

    const parsed = JSON.parse(extractJsonPayload(content));
    // Some local models emit `null` for fields they're unsure about instead of
    // omitting the key entirely. Treat null the same as "not provided" so it
    // doesn't fail schema validation or override a real value in the merge.
    const withoutNulls = Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => value !== null)
    );
    return extractedDataSchema.partial().parse(withoutNulls);
  } catch (error) {
    console.warn('LLM project-detail extraction failed, falling back to heuristics:', error);
    return {};
  }
}

/** Real, authoritative constraint facts (planning.data.gov.uk) — used as the default, before text-derived guesses. */
function siteConstraintsToFacts(constraints: SiteConstraints | undefined): Partial<ExtractedData> {
  if (!constraints) return {};
  return {
    conservationZone: constraints.conservationAreas.length > 0,
    floodZone: derivedFloodZoneLabel(constraints),
  };
}

export async function extractStructuredData(
  input: ApplicationInput & { siteConstraints?: SiteConstraints }
): Promise<ExtractedData> {
  const realFacts = siteConstraintsToFacts(input.siteConstraints);
  const heuristic = deterministicExtractFromText(input);
  const [llmFields, footprint] = await Promise.all([
    llmExtractProjectDetails(input),
    extractDxfFootprint(input),
  ]);

  // Precedence (lowest -> highest): real government data, text heuristics, LLM drawing/description
  // analysis, then explicit manual overrides from the "advanced site facts" form. The DXF footprint
  // (if any) is always real geometry, so it is applied last, after the manual override merge, and
  // only overrides the estimated footprint - it never gets clobbered by a manual "advanced facts" entry
  // that never had footprint data in the first place.
  const merged = extractedDataSchema.parse({
    ...realFacts,
    ...heuristic,
    ...llmFields,
    ...(input.extractedData || {}),
  });

  return footprint ? { ...merged, footprint } : merged;
}
