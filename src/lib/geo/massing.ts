// Builds an approximate 3D "massing block" footprint for the proposed works,
// derived from the extracted height/volume, offset from the site point. This
// is a schematic visual aid (not a survey-accurate model) - labelled as such
// in the UI - useful for giving judges/officers an immediate spatial sense of
// scale relative to real neighbouring buildings.

export interface MassingInput {
  lat: number;
  lng: number;
  proposedHeight?: number;
  proposedVolume?: number;
  /** Real width/depth (metres) parsed from an uploaded DXF drawing - see src/lib/services/dxf.ts. */
  footprint?: { 
    widthM: number; 
    depthM: number;
    rotationDeg?: number;
    latOffsetM?: number;
    lngOffsetM?: number;
    verticesM?: Array<{ x: number; y: number }>;
  };
}

const METRES_PER_DEGREE_LAT = 111320;

export function buildMassingFootprint(input: MassingInput) {
  const height = input.proposedHeight ?? 3;

  let widthM: number;
  let depthM: number;
  let isReal = false;

  if (input.footprint) {
    widthM = input.footprint.widthM;
    depthM = input.footprint.depthM;
    isReal = true;
  } else {
    const volume = input.proposedVolume ?? 30;
    const footprintArea = Math.max(9, volume / Math.max(height, 1));
    const side = Math.sqrt(footprintArea);
    widthM = side;
    depthM = side;
  }

  const metresPerDegreeLng = METRES_PER_DEGREE_LAT * Math.cos((input.lat * Math.PI) / 180);
  // Offset calculation: if manual offsets are provided, use them. Otherwise,
  // shift slightly "south-east" of the site point as a default schematic helper.
  const hasManualOffset = input.footprint?.latOffsetM !== undefined || input.footprint?.lngOffsetM !== undefined;
  const fallbackDLat = depthM / METRES_PER_DEGREE_LAT / 2;
  const fallbackDLng = widthM / metresPerDegreeLng / 2;
  
  const offsetLat = hasManualOffset
    ? (input.footprint?.latOffsetM || 0) / METRES_PER_DEGREE_LAT
    : -fallbackDLat * 0.6;
    
  const offsetLng = hasManualOffset
    ? (input.footprint?.lngOffsetM || 0) / metresPerDegreeLng
    : fallbackDLng * 0.6;

  const cLat = input.lat + offsetLat;
  const cLng = input.lng + offsetLng;
  // MapLibre coordinates use north-up geographic axes. The DXF/editor rotation
  // is shown clockwise in the UI, so invert it when projecting into lng/lat.
  const rotationRad = (-(input.footprint?.rotationDeg || 0) * Math.PI) / 180;
  const rotate = (x: number, y: number) => ({
    x: x * Math.cos(rotationRad) - y * Math.sin(rotationRad),
    y: x * Math.sin(rotationRad) + y * Math.cos(rotationRad),
  });

  const rawVertices = input.footprint?.verticesM?.length
    ? scaleVerticesToSize(input.footprint.verticesM, widthM, depthM)
    : [
        { x: -widthM / 2, y: -depthM / 2 },
        { x: widthM / 2, y: -depthM / 2 },
        { x: widthM / 2, y: depthM / 2 },
        { x: -widthM / 2, y: depthM / 2 },
      ];

  const ring: [number, number][] = rawVertices.map((point) => {
    const rotated = rotate(point.x, point.y);
    return [cLng + rotated.x / metresPerDegreeLng, cLat + rotated.y / METRES_PER_DEGREE_LAT];
  });

  if (ring.length > 0) ring.push(ring[0]);

  return {
    type: 'Feature' as const,
    properties: {
      height,
      widthM: Number(widthM.toFixed(1)),
      depthM: Number(depthM.toFixed(1)),
      rotationDeg: input.footprint?.rotationDeg || 0,
      isReal,
    },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [ring],
    },
  };
}

function scaleVerticesToSize(vertices: Array<{ x: number; y: number }>, targetWidthM: number, targetDepthM: number) {
  const xs = vertices.map((point) => point.x);
  const ys = vertices.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const currentWidth = maxX - minX;
  const currentDepth = maxY - minY;
  const scaleX = currentWidth > 0 ? targetWidthM / currentWidth : 1;
  const scaleY = currentDepth > 0 ? targetDepthM / currentDepth : 1;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return vertices.map((point) => ({
    x: (point.x - centerX) * scaleX,
    y: (point.y - centerY) * scaleY,
  }));
}
