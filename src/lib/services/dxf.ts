// Real footprint extraction from an uploaded DXF drawing (a text-based CAD
// interchange format any DWG-capable tool - AutoCAD, LibreCAD, QCAD, FreeCAD,
// Revit, etc. - can export via "Save As / Export DXF"). Binary .dwg itself is
// a proprietary Autodesk format with no reliable open-source parser, so DWG
// files are stored as evidence but NOT geometrically parsed - callers should
// treat a missing result as "no real footprint available, fall back to the
// schematic height/volume estimate" and say so plainly in the UI.

import DxfParser from 'dxf-parser';

export interface DxfFootprint {
  source: 'dxf';
  widthM: number;
  depthM: number;
  areaM2: number;
  vertexCount: number;
  unitAssumption: string;
  rotationDeg: number;
  centroidM: Vec2;
  verticesM: Vec2[];
  parserConfidence: 'high' | 'medium' | 'low';
  entityTypeCounts: Record<string, number>;
  layerSummaries: DxfLayerSummary[];
  structuralLayers: DxfStructuralLayer[];
}

interface Vec2 {
  x: number;
  y: number;
}

type StructuralSemantic =
  | 'existing'
  | 'proposed'
  | 'demolition'
  | 'walls'
  | 'openings'
  | 'floors'
  | 'roof'
  | 'electrical'
  | 'lighting'
  | 'plumbing'
  | 'hvac'
  | 'furniture'
  | 'annotation'
  | 'unknown';

interface DxfEntityShape {
  type: string;
  layer: string;
  closed?: boolean;
  text?: string;
  points: Vec2[];
}

export interface DxfLayerSummary {
  name: string;
  semantic: StructuralSemantic;
  entityCount: number;
  boundsM?: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface DxfStructuralLayer {
  name: string;
  semantic: StructuralSemantic;
  entityCount: number;
  entities: Array<{
    type: string;
    closed?: boolean;
    pointsM: Vec2[];
  }>;
}

// DXF header $INSUNITS group codes (subset) -> metres-per-unit.
const INSUNITS_TO_METRES: Record<number, number> = {
  1: 0.0254, // inches
  2: 0.3048, // feet
  4: 0.001, // millimetres
  5: 0.01, // centimetres
  6: 1, // metres
  8: 1000, // kilometres (unlikely for a building)
};

function classifyLayer(layerName: string, entityType?: string): StructuralSemantic {
  const name = layerName.toLowerCase().replace(/[_-]+/g, ' ');
  if (/\b(prop|proposed|new|extension)\b/.test(name)) return 'proposed';
  if (/\b(demo|demolish|remove|removed)\b/.test(name)) return 'demolition';
  if (/\b(existing|exist|survey)\b/.test(name)) return 'existing';
  if (/\b(wall|walls|partition|structure|pillar|column)\b/.test(name)) return 'walls';
  if (/\b(door|window|opening|glazing)\b/.test(name)) return 'openings';
  if (/\b(floor|slab|deck|plate)\b/.test(name)) return 'floors';
  if (/\b(roof|ridge|eaves)\b/.test(name)) return 'roof';
  if (/\b(elec|electrical|power|socket|outlet|cable)\b/.test(name)) return 'electrical';
  if (/\b(light|lighting|luminaire|lamp)\b/.test(name)) return 'lighting';
  if (/\b(plumb|water|drain|pipe|waste|sanitary)\b/.test(name)) return 'plumbing';
  if (/\b(hvac|duct|vent|heating|cooling|mechanical)\b/.test(name)) return 'hvac';
  if (/\b(furniture|furn|fixture|sanitary|kitchen)\b/.test(name)) return 'furniture';
  if (/\b(text|note|annotation|label|dimension|dim|arrow|border)\b/.test(name) || entityType === 'TEXT') return 'annotation';
  return 'unknown';
}

function entityPoints(raw: Record<string, unknown>): Vec2[] {
  const type = raw.type as string;

  if (type === 'LINE') {
    const start = raw.vertices ? (raw.vertices as Vec2[])[0] : (raw.start as Vec2 | undefined);
    const end = raw.vertices ? (raw.vertices as Vec2[])[1] : (raw.end as Vec2 | undefined);
    return [start, end].filter((point): point is Vec2 => !!point);
  }
  if (type === 'LWPOLYLINE' || type === 'POLYLINE') {
    return ((raw.vertices as Vec2[]) || []).filter(Boolean);
  }
  if (type === 'CIRCLE' || type === 'ARC') {
    const center = raw.center as Vec2 | undefined;
    const radius = (raw.radius as number) || 0;
    return center ? [{ x: center.x - radius, y: center.y - radius }, { x: center.x + radius, y: center.y + radius }] : [];
  }
  if (type === 'INSERT' && raw.position) return [raw.position as Vec2];
  if (type === 'TEXT' && raw.startPoint) return [raw.startPoint as Vec2];
  return [];
}

function collectShapes(dxf: ReturnType<DxfParser['parseSync']>): DxfEntityShape[] {
  const entities = (dxf && (dxf as { entities?: unknown[] }).entities) || [];
  const shapes: DxfEntityShape[] = [];

  for (const raw of entities as Array<Record<string, unknown>>) {
    const type = raw.type as string;
    const points = entityPoints(raw).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (points.length === 0) continue;

    shapes.push({
      type,
      layer: (raw.layer as string | undefined) || '0',
      closed: Boolean(raw.shape) || Boolean(raw.closed),
      text: typeof raw.text === 'string' ? raw.text : typeof raw.string === 'string' ? raw.string : undefined,
      points,
    });
  }

  return shapes;
}

function polygonArea(points: Vec2[]) {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area / 2);
}

function boundsFor(points: Vec2[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

function centroidFor(points: Vec2[]) {
  const bounds = boundsFor(points);
  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
}

function roundPoint(point: Vec2): Vec2 {
  return { x: Number(point.x.toFixed(3)), y: Number(point.y.toFixed(3)) };
}

function convertBounds(bounds: ReturnType<typeof boundsFor>, metresPerUnit: number) {
  return {
    minX: Number((bounds.minX * metresPerUnit).toFixed(3)),
    minY: Number((bounds.minY * metresPerUnit).toFixed(3)),
    maxX: Number((bounds.maxX * metresPerUnit).toFixed(3)),
    maxY: Number((bounds.maxY * metresPerUnit).toFixed(3)),
  };
}

/**
 * Parses a DXF file's text content and returns a real bounding-box footprint
 * (width x depth in metres), or null if the file has no usable 2D geometry.
 */
export function parseDxfFootprint(fileText: string): DxfFootprint | null {
  const parser = new DxfParser();
  let dxf: ReturnType<DxfParser['parseSync']>;

  try {
    dxf = parser.parseSync(fileText);
  } catch (error) {
    console.warn('DXF parse failed:', error);
    return null;
  }

  if (!dxf) return null;

  const shapes = collectShapes(dxf);
  const measuredShapes = shapes.filter((shape) => classifyLayer(shape.layer, shape.type) !== 'annotation');
  const points = (measuredShapes.length > 0 ? measuredShapes : shapes).flatMap((shape) => shape.points);
  if (points.length < 2) return null;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const rawWidth = Math.max(...xs) - Math.min(...xs);
  const rawDepth = Math.max(...ys) - Math.min(...ys);
  if (!Number.isFinite(rawWidth) || !Number.isFinite(rawDepth) || rawWidth <= 0 || rawDepth <= 0) {
    return null;
  }

  // Prefer the drawing's own declared unit ($INSUNITS); otherwise fall back to
  // a size heuristic, since most architectural DXF exports use mm or m.
  const insUnits = (dxf as { header?: Record<string, unknown> }).header?.['$INSUNITS'] as number | undefined;
  let metresPerUnit = insUnits !== undefined ? INSUNITS_TO_METRES[insUnits] : undefined;
  let unitAssumption = insUnits !== undefined && metresPerUnit ? `DXF $INSUNITS=${insUnits}` : '';

  if (!metresPerUnit) {
    const maxDim = Math.max(rawWidth, rawDepth);
    if (maxDim > 3000) {
      metresPerUnit = 0.001; // millimetres
      unitAssumption = 'assumed millimetres (large coordinate range)';
    } else if (maxDim > 300) {
      metresPerUnit = 0.01; // centimetres
      unitAssumption = 'assumed centimetres (mid coordinate range)';
    } else {
      metresPerUnit = 1; // already metres
      unitAssumption = 'assumed metres (small coordinate range)';
    }
  }

  const widthM = rawWidth * metresPerUnit;
  const depthM = rawDepth * metresPerUnit;

  // Sanity bounds for a UK householder-scale drawing - reject wildly implausible results
  // (e.g. a whole site survey/OS map export) rather than showing a misleading massing block.
  if (widthM < 0.5 || depthM < 0.5 || widthM > 200 || depthM > 200) {
    return null;
  }

  const closedPolygons = (measuredShapes.length > 0 ? measuredShapes : shapes)
    .filter((shape) => shape.closed && shape.points.length >= 3)
    .map((shape) => ({ shape, area: polygonArea(shape.points) }))
    .sort((a, b) => b.area - a.area);
  const footprintShape = closedPolygons.find((item) => classifyLayer(item.shape.layer, item.shape.type) === 'walls') || closedPolygons[0];
  const footprintPoints = footprintShape?.shape.points || [
    { x: Math.min(...xs), y: Math.min(...ys) },
    { x: Math.max(...xs), y: Math.min(...ys) },
    { x: Math.max(...xs), y: Math.max(...ys) },
    { x: Math.min(...xs), y: Math.max(...ys) },
  ];
  const centroid = centroidFor(footprintPoints);
  const verticesM = footprintPoints.map((point) =>
    roundPoint({
      x: (point.x - centroid.x) * metresPerUnit,
      y: (point.y - centroid.y) * metresPerUnit,
    })
  );
  const entityTypeCounts = shapes.reduce<Record<string, number>>((counts, shape) => {
    counts[shape.type] = (counts[shape.type] || 0) + 1;
    return counts;
  }, {});

  const byLayer = new Map<string, DxfEntityShape[]>();
  shapes.forEach((shape) => byLayer.set(shape.layer, [...(byLayer.get(shape.layer) || []), shape]));

  const layerSummaries: DxfLayerSummary[] = Array.from(byLayer.entries()).map(([name, layerShapes]) => {
    const layerPoints = layerShapes.flatMap((shape) => shape.points);
    return {
      name,
      semantic: classifyLayer(name, layerShapes[0]?.type),
      entityCount: layerShapes.length,
      boundsM: layerPoints.length > 0 ? convertBounds(boundsFor(layerPoints), metresPerUnit) : undefined,
    };
  });

  const structuralLayers: DxfStructuralLayer[] = Array.from(byLayer.entries()).map(([name, layerShapes]) => ({
    name,
    semantic: classifyLayer(name, layerShapes[0]?.type),
    entityCount: layerShapes.length,
    entities: layerShapes.slice(0, 160).map((shape) => ({
      type: shape.type,
      closed: shape.closed,
      text: shape.text,
      pointsM: shape.points.map((point) =>
        roundPoint({
          x: (point.x - centroid.x) * metresPerUnit,
          y: (point.y - centroid.y) * metresPerUnit,
        })
      ),
    })),
  }));

  return {
    source: 'dxf',
    widthM: Number(widthM.toFixed(2)),
    depthM: Number(depthM.toFixed(2)),
    areaM2: Number((widthM * depthM).toFixed(1)),
    vertexCount: points.length,
    unitAssumption,
    rotationDeg: 0,
    centroidM: roundPoint({ x: centroid.x * metresPerUnit, y: centroid.y * metresPerUnit }),
    verticesM,
    parserConfidence: footprintShape ? 'medium' : 'low',
    entityTypeCounts,
    layerSummaries,
    structuralLayers,
  };
}
