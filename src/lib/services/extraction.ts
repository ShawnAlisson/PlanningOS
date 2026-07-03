import { extractedDataSchema, type ApplicationInput, type ExtractedData } from '../schemas';
import { getStoredNameFromUrl, readStoredBlob } from '../storage/blob';

function isImageFile(fileName: string, mimeType?: string) {
  return (
    Boolean(mimeType && mimeType.startsWith('image/')) ||
    /\.(png|jpg|jpeg|webp)$/i.test(fileName)
  );
}

function deterministicExtract(input: ApplicationInput): ExtractedData {
  const text = `${input.title} ${input.address} ${input.description}`.toLowerCase();

  const propertyType =
    text.includes('terrace') || text.includes('terraced')
      ? 'Terraced'
      : text.includes('detached')
      ? 'Detached'
      : text.includes('semi')
      ? 'Semi-detached'
      : 'Semi-detached';

  const extensionType =
    text.includes('loft') || text.includes('roof') ? 'loft' : text.includes('side') ? 'side' : 'rear';

  const proposedHeight = text.includes('two storey') ? 5 : text.includes('single storey') ? 3.2 : 2.8;
  const proposedVolume = text.includes('large') ? 48 : text.includes('dormer') ? 38 : 30;

  return extractedDataSchema.parse({
    propertyType,
    extensionType,
    proposedHeight,
    proposedVolume,
    conservationZone: text.includes('conservation') || text.includes('heritage') || text.includes('listed'),
    floodZone: text.includes('flood zone 3') || text.includes('zone 3') ? 'Zone 3' : text.includes('zone 2') ? 'Zone 2' : 'Zone 1',
    highwaysProximity: text.includes('highway') || text.includes('road'),
    neighbourImpactLevel: text.includes('overlooking') || text.includes('overbear') ? 'high' : text.includes('privacy') ? 'medium' : 'low',
  });
}

async function llmExtract(input: ApplicationInput): Promise<ExtractedData> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY;
  if (!apiKey) {
    return deterministicExtract(input);
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

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Extract planning-relevant fields from the proposal and return JSON with propertyType, extensionType, proposedHeight, proposedVolume, conservationZone, floodZone, highwaysProximity, neighbourImpactLevel, boundaryDistance, originalHouseWidth.',
          },
          {
            role: 'user',
            content: imagePayload
              ? [
                  {
                    type: 'text',
                    text:
                      'Inspect this planning drawing or site image. Return JSON with propertyType, extensionType, proposedHeight, proposedVolume, conservationZone, floodZone, highwaysProximity, neighbourImpactLevel, boundaryDistance, originalHouseWidth. If uncertain, keep fields conservative and explain via the textual fallback.',
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: imagePayload,
                    },
                  },
                ]
              : JSON.stringify(input),
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`LLM extraction failed: ${res.status}`);
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('LLM extraction returned no content');
    }

    return extractedDataSchema.parse(JSON.parse(content));
  } catch (error) {
    console.warn('Falling back to deterministic extraction:', error);
    return deterministicExtract(input);
  }
}

export async function extractStructuredData(input: ApplicationInput): Promise<ExtractedData> {
  return llmExtract(input);
}
