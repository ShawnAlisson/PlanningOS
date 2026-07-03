import { NextResponse } from 'next/server';
import { lookupPostcode } from '@/lib/services/postcodes';
import { fetchSiteConstraints, derivedFloodZoneLabel } from '@/lib/services/planningData';

export const runtime = 'nodejs';

// Real UK planning constraints (conservation areas, listed buildings, flood
// risk zones, green belt, Article 4 directions, ...) for a given postcode,
// sourced live from planning.data.gov.uk. No API key, no fabricated data.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const postcode = searchParams.get('postcode');
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');

    let lat: number | undefined;
    let lng: number | undefined;
    let resolved: Awaited<ReturnType<typeof lookupPostcode>> = null;

    if (postcode) {
      resolved = await lookupPostcode(postcode);
      if (!resolved) {
        return NextResponse.json({ error: `Could not resolve postcode "${postcode}"` }, { status: 404 });
      }
      lat = resolved.latitude;
      lng = resolved.longitude;
    } else if (latParam && lngParam) {
      lat = Number(latParam);
      lng = Number(lngParam);
    }

    if (lat === undefined || lng === undefined || Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: 'Provide either ?postcode= or ?lat=&lng=' }, { status: 400 });
    }

    const constraints = await fetchSiteConstraints(lat, lng);

    return NextResponse.json({
      geo: resolved
        ? {
            lat,
            lng,
            postcode: resolved.postcode,
            adminDistrict: resolved.adminDistrict,
            adminWard: resolved.adminWard,
            region: resolved.region,
            parliamentaryConstituency: resolved.parliamentaryConstituency,
          }
        : { lat, lng },
      floodZone: derivedFloodZoneLabel(constraints),
      constraints,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
