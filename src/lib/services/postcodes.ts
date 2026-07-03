// Thin server-side wrapper around postcodes.io (postcodes.io) — a free, open,
// no-API-key UK postcode/geocoding service (MIT licensed, ONS/OS data).
// Docs: https://postcodes.io/docs/overview

const BASE_URL = 'https://api.postcodes.io';

export interface PostcodeResult {
  postcode: string;
  latitude: number;
  longitude: number;
  adminDistrict: string | null;
  adminWard: string | null;
  parish: string | null;
  region: string | null;
  country: string | null;
  parliamentaryConstituency: string | null;
  outcode: string;
}

function normalizePostcodeResult(raw: Record<string, unknown>): PostcodeResult | null {
  if (typeof raw.postcode !== 'string' || typeof raw.latitude !== 'number' || typeof raw.longitude !== 'number') {
    return null;
  }

  return {
    postcode: raw.postcode,
    latitude: raw.latitude,
    longitude: raw.longitude,
    adminDistrict: (raw.admin_district as string) ?? null,
    adminWard: (raw.admin_ward as string) ?? null,
    parish: (raw.parish as string) ?? null,
    region: (raw.region as string) ?? null,
    country: (raw.country as string) ?? null,
    parliamentaryConstituency: (raw.parliamentary_constituency as string) ?? null,
    outcode: (raw.outcode as string) ?? String(raw.postcode).split(' ')[0],
  };
}

/** Prefix search used for address/postcode autocomplete while the user types. */
export async function autocompletePostcodes(query: string): Promise<string[]> {
  const clean = query.replace(/\s+/g, '');
  if (clean.length < 2) return [];

  const res = await fetch(`${BASE_URL}/postcodes/${encodeURIComponent(clean)}/autocomplete?limit=6`);
  if (!res.ok) return [];
  const json = await res.json();
  if (json.status !== 200 || !Array.isArray(json.result)) return [];
  return json.result as string[];
}

export async function lookupPostcode(postcode: string): Promise<PostcodeResult | null> {
  const res = await fetch(`${BASE_URL}/postcodes/${encodeURIComponent(postcode.trim())}`);
  if (!res.ok) return null;
  const json = await res.json();
  if (json.status !== 200 || !json.result) return null;
  return normalizePostcodeResult(json.result);
}

/** Free-text search fallback (place names, partial postcodes) via the bulk postcode query endpoint. */
export async function searchPostcodes(query: string): Promise<PostcodeResult[]> {
  const res = await fetch(`${BASE_URL}/postcodes?q=${encodeURIComponent(query.trim())}&limit=6`);
  if (!res.ok) return [];
  const json = await res.json();
  if (json.status !== 200 || !Array.isArray(json.result)) return [];
  return json.result
    .map((entry: Record<string, unknown>) => normalizePostcodeResult(entry))
    .filter((entry: PostcodeResult | null): entry is PostcodeResult => entry !== null);
}

export async function reverseGeocode(lat: number, lng: number): Promise<PostcodeResult | null> {
  const res = await fetch(`${BASE_URL}/postcodes?lon=${lng}&lat=${lat}&limit=1`);
  if (!res.ok) return null;
  const json = await res.json();
  if (json.status !== 200 || !Array.isArray(json.result) || json.result.length === 0) return null;
  return normalizePostcodeResult(json.result[0]);
}
