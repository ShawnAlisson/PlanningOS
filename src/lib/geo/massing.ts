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
}

const METRES_PER_DEGREE_LAT = 111320;

export function buildMassingFootprint(input: MassingInput) {
  const height = input.proposedHeight ?? 3;
  const volume = input.proposedVolume ?? 30;
  const footprintArea = Math.max(9, volume / Math.max(height, 1));
  const side = Math.sqrt(footprintArea);

  const metresPerDegreeLng = METRES_PER_DEGREE_LAT * Math.cos((input.lat * Math.PI) / 180);
  const dLat = side / METRES_PER_DEGREE_LAT / 2;
  const dLng = side / metresPerDegreeLng / 2;

  // Offset slightly "south-east" of the site point so it reads as an addition
  // to the existing building rather than sitting exactly on the postcode centroid.
  const offsetLat = -dLat * 0.6;
  const offsetLng = dLng * 0.6;
  const cLat = input.lat + offsetLat;
  const cLng = input.lng + offsetLng;

  const ring: [number, number][] = [
    [cLng - dLng, cLat - dLat],
    [cLng + dLng, cLat - dLat],
    [cLng + dLng, cLat + dLat],
    [cLng - dLng, cLat + dLat],
    [cLng - dLng, cLat - dLat],
  ];

  return {
    type: 'Feature' as const,
    properties: { height, side: Number(side.toFixed(1)) },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [ring],
    },
  };
}
