import { NextResponse } from 'next/server';
import { autocompletePostcodes, lookupPostcode } from '@/lib/services/postcodes';

export const runtime = 'nodejs';

// Real, live UK postcode search - proxied server-side to postcodes.io (free,
// no API key, ONS/OS data). No synthetic addresses or fabricated site facts.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('q') || '').trim();

    if (query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const codes = await autocompletePostcodes(query);
    const details = await Promise.all(codes.map((code) => lookupPostcode(code)));

    const results = details
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .map((entry) => ({
        postcode: entry.postcode,
        label: entry.postcode,
        adminDistrict: entry.adminDistrict,
        adminWard: entry.adminWard,
        region: entry.region,
        country: entry.country,
        latitude: entry.latitude,
        longitude: entry.longitude,
      }));

    return NextResponse.json({ results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
