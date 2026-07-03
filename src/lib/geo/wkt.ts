// Minimal WKT -> GeoJSON geometry parser, covering the shapes returned by
// planning.data.gov.uk (POINT, POLYGON, MULTIPOLYGON). No external dependency
// needed for a hackathon-scoped set of geometry types.

export type GeoJSONGeometry =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

function parseCoordPair(pair: string): [number, number] {
  const [lng, lat] = pair.trim().split(/\s+/).map(Number);
  return [lng, lat];
}

function parseRing(ring: string): number[][] {
  return ring
    .trim()
    .split(',')
    .map((pair) => parseCoordPair(pair));
}

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const char of input) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function stripOuter(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseWKT(wkt: string): GeoJSONGeometry | null {
  const trimmed = wkt.trim().replace(/\n/g, ' ');
  const match = trimmed.match(/^([A-Za-z]+)\s*\(([\s\S]*)\)$/i);
  if (!match) return null;

  const type = match[1].toUpperCase();
  const body = match[2];

  if (type === 'POINT') {
    return { type: 'Point', coordinates: parseCoordPair(body) };
  }

  if (type === 'POLYGON') {
    const rings = splitTopLevel(body).map((ring) => parseRing(stripOuter(ring)));
    return { type: 'Polygon', coordinates: rings };
  }

  if (type === 'MULTIPOLYGON') {
    // body = list of polygons, each itself wrapped in an extra paren layer around its list of rings.
    const polygons = splitTopLevel(body).map((polygonStr) => {
      const ringsStr = stripOuter(polygonStr);
      return splitTopLevel(ringsStr).map((ringStr) => parseRing(stripOuter(ringStr)));
    });
    return { type: 'MultiPolygon', coordinates: polygons };
  }

  return null;
}

export interface SimpleFeature {
  type: 'Feature';
  geometry: GeoJSONGeometry;
  properties: Record<string, unknown>;
}

export function geometryToFeature(geometry: GeoJSONGeometry, properties: Record<string, unknown>): SimpleFeature {
  return {
    type: 'Feature',
    geometry,
    properties,
  };
}

/** Rough centroid for label placement / distance heuristics (not geodesically precise, fine for hackathon-scale UI use). */
export function approximateCentroid(geometry: GeoJSONGeometry): [number, number] {
  const points: number[][] = [];

  const collect = (coords: unknown): void => {
    if (Array.isArray(coords) && typeof coords[0] === 'number') {
      points.push(coords as number[]);
      return;
    }
    if (Array.isArray(coords)) {
      coords.forEach(collect);
    }
  };

  collect(geometry.coordinates);
  if (points.length === 0) return [0, 0];

  const sum = points.reduce(
    (acc, [lng, lat]) => [acc[0] + lng, acc[1] + lat],
    [0, 0]
  );
  return [sum[0] / points.length, sum[1] / points.length];
}

function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function distanceMeters(a: [number, number], b: [number, number]): number {
  return haversineMeters(a, b);
}
