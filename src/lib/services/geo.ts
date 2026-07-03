import { lookupPostcode } from './postcodes';
import { fetchSiteConstraints, type SiteConstraints } from './planningData';
import type { GeoPoint } from '../types';

// Standard UK postcode pattern (relaxed), e.g. "SE22 8NG", "BA1 5HG", "SW1A 1AA".
const UK_POSTCODE_REGEX = /([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

export function extractPostcode(text: string): string | null {
  const match = text.match(UK_POSTCODE_REGEX);
  if (!match) return null;
  return `${match[1].toUpperCase()} ${match[2].toUpperCase()}`;
}

export async function resolveGeoFromAddress(address: string): Promise<GeoPoint | null> {
  const postcode = extractPostcode(address);
  if (!postcode) return null;

  try {
    const result = await lookupPostcode(postcode);
    if (!result) return null;

    return {
      lat: result.latitude,
      lng: result.longitude,
      postcode: result.postcode,
      adminDistrict: result.adminDistrict,
      adminWard: result.adminWard,
      region: result.region,
      parliamentaryConstituency: result.parliamentaryConstituency,
    };
  } catch (error) {
    console.warn('postcodes.io lookup failed:', error);
    return null;
  }
}

export async function resolveSiteContext(address: string): Promise<{ geo: GeoPoint | null; siteConstraints: SiteConstraints | undefined }> {
  const geo = await resolveGeoFromAddress(address);
  if (!geo) return { geo: null, siteConstraints: undefined };

  const siteConstraints = await fetchSiteConstraints(geo.lat, geo.lng);
  return { geo, siteConstraints };
}
