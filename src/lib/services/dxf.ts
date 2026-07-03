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
}

interface Vec2 {
  x: number;
  y: number;
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

function collectVertices(dxf: ReturnType<DxfParser['parseSync']>): Vec2[] {
  const points: Vec2[] = [];
  const entities = (dxf && (dxf as { entities?: unknown[] }).entities) || [];

  for (const raw of entities as Array<Record<string, unknown>>) {
    const type = raw.type as string;

    if (type === 'LINE') {
      const start = raw.vertices ? (raw.vertices as Vec2[])[0] : (raw.start as Vec2 | undefined);
      const end = raw.vertices ? (raw.vertices as Vec2[])[1] : (raw.end as Vec2 | undefined);
      if (start) points.push(start);
      if (end) points.push(end);
    } else if (type === 'LWPOLYLINE' || type === 'POLYLINE') {
      const vertices = (raw.vertices as Vec2[]) || [];
      vertices.forEach((v) => v && points.push(v));
    } else if (type === 'CIRCLE' || type === 'ARC') {
      const center = raw.center as Vec2 | undefined;
      const radius = (raw.radius as number) || 0;
      if (center) {
        points.push({ x: center.x - radius, y: center.y - radius });
        points.push({ x: center.x + radius, y: center.y + radius });
      }
    } else if (type === 'INSERT' && raw.position) {
      points.push(raw.position as Vec2);
    }
  }

  return points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
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

  const points = collectVertices(dxf);
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

  return {
    source: 'dxf',
    widthM: Number(widthM.toFixed(2)),
    depthM: Number(depthM.toFixed(2)),
    areaM2: Number((widthM * depthM).toFixed(1)),
    vertexCount: points.length,
    unitAssumption,
  };
}
