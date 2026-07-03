'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Box, Layers3, Loader2, MapPin } from 'lucide-react';
import type { Application, PlanningDecision } from '@/lib/types';
import type { GeoJSONGeometry } from '@/lib/geo/wkt';
import { buildMassingFootprint } from '@/lib/geo/massing';

const DECISION_COLOR: Record<PlanningDecision, string> = {
  approve: '#059669',
  review: '#d97706',
  reject: '#e11d48',
};

const CONSTRAINT_STYLES: { key: keyof NonNullable<Application['siteConstraints']>; color: string; label: string }[] = [
  { key: 'conservationAreas', color: '#f59e0b', label: 'Conservation area' },
  { key: 'floodRiskZones', color: '#0ea5e9', label: 'Flood risk zone' },
  { key: 'greenBelt', color: '#16a34a', label: 'Green belt' },
  { key: 'article4Directions', color: '#dc2626', label: 'Article 4 direction' },
];

interface SiteMap3DProps {
  application: Application;
  recommendation?: PlanningDecision;
  overrideHeight?: number;
  overrideWidth?: number;
  overrideDepth?: number;
  overrideRotationDeg?: number;
  overrideLatOffsetM?: number;
  overrideLngOffsetM?: number;
}

export default function SiteMap3D({
  application,
  recommendation,
  overrideHeight,
  overrideWidth,
  overrideDepth,
  overrideRotationDeg,
  overrideLatOffsetM,
  overrideLngOffsetM,
}: SiteMap3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const geo = application.geo;
  const footprint = application.extractedData?.footprint;

  // Use override values if provided, falling back to application metadata or standard defaults
  const activeHeight = overrideHeight !== undefined ? overrideHeight : (application.extractedData?.proposedHeight ?? 3);
  const activeVolume = application.extractedData?.proposedVolume;
  const activeWidthM = overrideWidth !== undefined ? overrideWidth : (footprint?.widthM ?? 10);
  const activeDepthM = overrideDepth !== undefined ? overrideDepth : (footprint?.depthM ?? 10);
  const activeRotationDeg = overrideRotationDeg !== undefined ? overrideRotationDeg : (footprint?.rotationDeg ?? 0);
  const activeLatOffsetM = overrideLatOffsetM !== undefined ? overrideLatOffsetM : footprint?.latOffsetM;
  const activeLngOffsetM = overrideLngOffsetM !== undefined ? overrideLngOffsetM : footprint?.lngOffsetM;

  useEffect(() => {
    if (!geo || !containerRef.current) return;
    setReady(false);
    setError(null);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [geo.lng, geo.lat],
      zoom: 17.2,
      pitch: 62,
      bearing: -18,
    });

    mapRef.current = map;

    map.on('error', (e) => {
      console.warn('Map tile error (non-fatal):', e?.error?.message);
      setError('Live map tiles could not be reached from this network — the constraint data and analysis above are unaffected.');
    });

    map.on('load', () => {
      // Site marker
      new maplibregl.Marker({ color: '#7c3aed' }).setLngLat([geo.lng, geo.lat]).addTo(map);

      // Real constraint polygons from planning.data.gov.uk
      const constraints = application.siteConstraints;
      if (constraints) {
        CONSTRAINT_STYLES.forEach(({ key, color }) => {
          const entities = constraints[key] as Array<{ geometry?: GeoJSONGeometry | null; name: string; entityUrl: string }>;
          const features = (entities || [])
            .filter((entity) => entity.geometry && (entity.geometry.type === 'Polygon' || entity.geometry.type === 'MultiPolygon'))
            .map((entity) => ({
              type: 'Feature' as const,
              properties: { name: entity.name, url: entity.entityUrl },
              geometry: entity.geometry as GeoJSONGeometry,
            }));

          if (features.length === 0) return;

          const sourceId = `constraint-${key}`;
          map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features } });
          map.addLayer({
            id: `${sourceId}-fill`,
            type: 'fill',
            source: sourceId,
            paint: { 'fill-color': color, 'fill-opacity': 0.22 },
          });
          map.addLayer({
            id: `${sourceId}-line`,
            type: 'line',
            source: sourceId,
            paint: { 'line-color': color, 'line-width': 2 },
          });
        });
      }

      // Proposed massing - schematic 3D extrusion coloured by recommendation
      const massing = buildMassingFootprint({
        lat: geo.lat,
        lng: geo.lng,
        proposedHeight: activeHeight,
        proposedVolume: activeVolume,
        footprint: {
          widthM: activeWidthM,
          depthM: activeDepthM,
          rotationDeg: activeRotationDeg,
          latOffsetM: activeLatOffsetM,
          lngOffsetM: activeLngOffsetM,
          verticesM: footprint?.verticesM,
        },
      });

      map.addSource('proposed-massing', { type: 'geojson', data: massing });
      map.addLayer({
        id: 'proposed-massing-extrusion',
        type: 'fill-extrusion',
        source: 'proposed-massing',
        paint: {
          'fill-extrusion-color': recommendation ? DECISION_COLOR[recommendation] : '#7c3aed',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-opacity': 0.85,
        },
      });

      setReady(true);
    });

    return () => {
      setReady(false);
      map.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo?.lat, geo?.lng]);

  // Real-time reactive updates of the 3D massing source data (60fps, no map reloads)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !geo) return;

    let source: maplibregl.GeoJSONSource | undefined;
    try {
      source = map.getSource('proposed-massing') as maplibregl.GeoJSONSource | undefined;
    } catch {
      return;
    }
    if (!source) return;

    const massing = buildMassingFootprint({
      lat: geo.lat,
      lng: geo.lng,
      proposedHeight: activeHeight,
      proposedVolume: activeVolume,
        footprint: {
          widthM: activeWidthM,
          depthM: activeDepthM,
          rotationDeg: activeRotationDeg,
          latOffsetM: activeLatOffsetM,
          lngOffsetM: activeLngOffsetM,
          verticesM: footprint?.verticesM,
        },
      });

    try {
      source.setData(massing);
      if (map.getLayer('proposed-massing-extrusion')) {
        map.setPaintProperty('proposed-massing-extrusion', 'fill-extrusion-height', ['get', 'height']);
      }
      map.triggerRepaint();
    } catch {
      // MapLibre can briefly remove sources while React remounts during hot
      // updates or route transitions. The next render tick will resync it.
    }
  }, [ready, geo, activeHeight, activeVolume, activeWidthM, activeDepthM, activeRotationDeg, activeLatOffsetM, activeLngOffsetM, footprint?.verticesM]);

  if (!geo) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-10 text-center">
        <MapPin className="h-6 w-6 text-zinc-300" />
        <p className="text-xs font-semibold text-slate-500">No geocoded site location for this application yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative h-[420px] w-full overflow-hidden rounded-2xl border border-zinc-200 shadow-sm">
        <div ref={containerRef} className="h-full w-full" />
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-violet-600" /> Loading real 3D map tiles…
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-x-0 bottom-0 bg-amber-50/95 border-t border-amber-200 px-3 py-2 text-[10px] font-semibold text-amber-800">
            {error}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold text-slate-500">
        <span className="inline-flex items-center gap-1"><Box className="h-3 w-3 text-violet-600" /> Purple pin: site (postcode centroid, {geo.postcode})</span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: recommendation ? DECISION_COLOR[recommendation] : '#7c3aed' }} />
          {footprint
            ? `Extruded block: real footprint from uploaded DXF (${footprint.widthM}m × ${footprint.depthM}m, ${footprint.unitAssumption}), ${application.extractedData?.proposedHeight ?? 3}m tall`
            : `Extruded block: schematic estimated massing (${application.extractedData?.proposedHeight ?? 3}m tall) — upload a DXF drawing for a real footprint`}
        </span>
        <span className="inline-flex items-center gap-1">Rotation {activeRotationDeg.toFixed(0)}° · {footprint?.parserConfidence ? `DXF confidence ${footprint.parserConfidence}` : 'schematic confidence low'}</span>
        {CONSTRAINT_STYLES.map(({ key, color, label }) => {
          const count = (application.siteConstraints?.[key] as unknown[] | undefined)?.length || 0;
          if (!count) return null;
          return (
            <span key={key} className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color, opacity: 0.6 }} />
              {label} ({count})
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1 ml-auto text-slate-400">
          <Layers3 className="h-3 w-3" /> MapLibre GL + OpenFreeMap (open data, no API key)
        </span>
      </div>
    </div>
  );
}
