// Real UK planning constraints from planning.data.gov.uk — the government's
// open Planning Data Platform (100+ datasets: conservation areas, listed
// buildings, flood risk zones, green belt, Article 4 directions, etc).
// No API key required. Docs: https://www.planning.data.gov.uk/docs

import { parseWKT, GeoJSONGeometry } from '../geo/wkt';

const BASE_URL = 'https://www.planning.data.gov.uk';

export const CONSTRAINT_DATASETS = [
  'conservation-area',
  'listed-building',
  'flood-risk-zone',
  'green-belt',
  'article-4-direction-area',
  'tree-preservation-zone',
  'park-and-garden',
  'scheduled-monument',
  'site-of-special-scientific-interest',
] as const;

export type ConstraintDataset = (typeof CONSTRAINT_DATASETS)[number];

export interface ConstraintEntity {
  entityId: number;
  dataset: ConstraintDataset;
  name: string;
  reference: string;
  entityUrl: string;
  documentationUrl?: string;
  designationDate?: string;
  floodRiskLevel?: string;
  floodRiskType?: string;
  listedBuildingGrade?: string;
  geometry?: GeoJSONGeometry | null;
}

export interface SiteConstraints {
  source: 'planning.data.gov.uk';
  retrievedAt: string;
  point: { lat: number; lng: number };
  conservationAreas: ConstraintEntity[];
  listedBuildings: ConstraintEntity[];
  floodRiskZones: ConstraintEntity[];
  greenBelt: ConstraintEntity[];
  article4Directions: ConstraintEntity[];
  treePreservationZones: ConstraintEntity[];
  parksAndGardens: ConstraintEntity[];
  scheduledMonuments: ConstraintEntity[];
  sssi: ConstraintEntity[];
  totalConstraints: number;
}

interface RawEntity {
  entity: number;
  dataset: string;
  name?: string;
  reference?: string;
  geometry?: string;
  point?: string;
  'documentation-url'?: string;
  'designation-date'?: string;
  'start-date'?: string;
  'flood-risk-level'?: string;
  'flood-risk-type'?: string;
  'listed-building-grade'?: string;
}

function toConstraintEntity(raw: RawEntity): ConstraintEntity {
  return {
    entityId: raw.entity,
    dataset: raw.dataset as ConstraintDataset,
    name: raw.name || raw.reference || `${raw.dataset} #${raw.entity}`,
    reference: raw.reference || String(raw.entity),
    entityUrl: `${BASE_URL}/entity/${raw.entity}`,
    documentationUrl: raw['documentation-url'] || undefined,
    designationDate: raw['designation-date'] || raw['start-date'] || undefined,
    floodRiskLevel: raw['flood-risk-level'] || undefined,
    floodRiskType: raw['flood-risk-type'] || undefined,
    listedBuildingGrade: raw['listed-building-grade'] || undefined,
    geometry: raw.geometry ? parseWKT(raw.geometry) : raw.point ? parseWKT(raw.point) : null,
  };
}

function emptyConstraints(lat: number, lng: number): SiteConstraints {
  return {
    source: 'planning.data.gov.uk',
    retrievedAt: new Date().toISOString(),
    point: { lat, lng },
    conservationAreas: [],
    listedBuildings: [],
    floodRiskZones: [],
    greenBelt: [],
    article4Directions: [],
    treePreservationZones: [],
    parksAndGardens: [],
    scheduledMonuments: [],
    sssi: [],
    totalConstraints: 0,
  };
}

export async function fetchSiteConstraints(lat: number, lng: number): Promise<SiteConstraints> {
  const params = new URLSearchParams();
  params.set('latitude', String(lat));
  params.set('longitude', String(lng));
  CONSTRAINT_DATASETS.forEach((dataset) => params.append('dataset', dataset));
  params.set('limit', '100');

  const url = `${BASE_URL}/entity.json?${params.toString()}`;

  let entities: RawEntity[] = [];
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const json = await res.json();
      entities = Array.isArray(json.entities) ? json.entities : [];
    }
  } catch (error) {
    console.warn('planning.data.gov.uk lookup failed, continuing with empty constraints:', error);
  }

  const result = emptyConstraints(lat, lng);

  for (const raw of entities) {
    const entity = toConstraintEntity(raw);
    switch (entity.dataset) {
      case 'conservation-area':
        result.conservationAreas.push(entity);
        break;
      case 'listed-building':
        result.listedBuildings.push(entity);
        break;
      case 'flood-risk-zone':
        result.floodRiskZones.push(entity);
        break;
      case 'green-belt':
        result.greenBelt.push(entity);
        break;
      case 'article-4-direction-area':
        result.article4Directions.push(entity);
        break;
      case 'tree-preservation-zone':
        result.treePreservationZones.push(entity);
        break;
      case 'park-and-garden':
        result.parksAndGardens.push(entity);
        break;
      case 'scheduled-monument':
        result.scheduledMonuments.push(entity);
        break;
      case 'site-of-special-scientific-interest':
        result.sssi.push(entity);
        break;
      default:
        break;
    }
  }

  result.totalConstraints =
    result.conservationAreas.length +
    result.listedBuildings.length +
    result.floodRiskZones.length +
    result.greenBelt.length +
    result.article4Directions.length +
    result.treePreservationZones.length +
    result.parksAndGardens.length +
    result.scheduledMonuments.length +
    result.sssi.length;

  return result;
}

/** Highest flood-risk-level found at the point, or null if the point has no mapped flood-zone entity (i.e. Flood Zone 1). */
export function derivedFloodZoneLabel(constraints: SiteConstraints): string {
  if (constraints.floodRiskZones.length === 0) return 'Zone 1';
  const levels = constraints.floodRiskZones.map((entity) => Number(entity.floodRiskLevel) || 0);
  const maxLevel = Math.max(...levels);
  return maxLevel >= 3 ? 'Zone 3' : maxLevel === 2 ? 'Zone 2' : 'Zone 1';
}
