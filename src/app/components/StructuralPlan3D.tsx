'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Eye, Layers3, Move3D, RotateCcw, Sparkles } from 'lucide-react';
import type { Application } from '@/lib/types';

type Footprint = NonNullable<NonNullable<Application['extractedData']>['footprint']>;
type StructuralLayer = NonNullable<Footprint['structuralLayers']>[number];
type Semantic = StructuralLayer['semantic'];
type RenderLayer = StructuralLayer & { semantic: Semantic; generated?: boolean };

const SEMANTIC_COLORS: Record<Semantic, number> = {
  existing: 0x64748b,
  proposed: 0x7c3aed,
  demolition: 0xef4444,
  walls: 0x1f2937,
  openings: 0x0ea5e9,
  floors: 0xe2e8f0,
  roof: 0x475569,
  electrical: 0xfacc15,
  lighting: 0xfbbf24,
  plumbing: 0x2563eb,
  hvac: 0x14b8a6,
  furniture: 0x10b981,
  annotation: 0xf59e0b,
  unknown: 0x94a3b8,
};

const PROPOSED_HINTS = /\b(prop|proposed|new|extension)\b/i;
const EXISTING_HINTS = /\b(existing|exist|survey)\b/i;
const SERVICE_SEMANTICS: Semantic[] = ['electrical', 'lighting', 'plumbing', 'hvac'];
const WALL_HINTS = /\b(wall|walls|partition|structure|pillar|column)\b/i;
const OPENING_HINTS = /\b(door|window|opening|glazing)\b/i;
const FLOOR_HINTS = /\b(floor|slab|deck|plate)\b/i;
const ROOF_HINTS = /\b(roof|ridge|eaves)\b/i;

interface StructuralPlan3DProps {
  application: Application;
  overrideHeight: number;
  overrideWidth: number;
  overrideDepth: number;
  overrideRotationDeg: number;
}

export default function StructuralPlan3D({
  application,
  overrideHeight,
  overrideWidth,
  overrideDepth,
  overrideRotationDeg,
}: StructuralPlan3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const footprint = application.extractedData?.footprint;

  const rawLayers = useMemo(() => {
    if (footprint?.structuralLayers?.length) {
      return footprint.structuralLayers;
    }
    const propertyType = application.extractedData?.propertyType || 'Semi-detached';
    const extensionType = application.extractedData?.extensionType || 'rear';
    return generateSchematicLayers(propertyType, extensionType, overrideWidth, overrideDepth);
  }, [footprint?.structuralLayers, application.extractedData, overrideWidth, overrideDepth]);

  const layers = useMemo(() => normalizeLayers(rawLayers, overrideWidth, overrideDepth), [rawLayers, overrideWidth, overrideDepth]);
  const floors = useMemo(() => buildFloors(overrideHeight), [overrideHeight]);

  const [viewMode, setViewMode] = useState<'before' | 'after' | 'compare'>('compare');
  const [xray, setXray] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [visibleFloorIds, setVisibleFloorIds] = useState<Record<string, boolean>>({});
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({});
  const [isControlModalOpen, setIsControlModalOpen] = useState(false);

  const existingImageFile = useMemo(() => {
    return application.files?.find((f) => f.role === 'existing' && /\.(png|jpg|jpeg|webp)$/i.test(f.name));
  }, [application.files]);

  const proposedImageFile = useMemo(() => {
    return application.files?.find((f) => f.role === 'proposed' && /\.(png|jpg|jpeg|webp)$/i.test(f.name));
  }, [application.files]);

  const imageFile = useMemo(() => {
    return application.files?.find((f) => /\.(png|jpg|jpeg|webp)$/i.test(f.name));
  }, [application.files]);

  const dxfFile = useMemo(() => {
    return application.files?.find((f) => /\.dxf$/i.test(f.name));
  }, [application.files]);

  useEffect(() => {
    if (!mountRef.current) return;

    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf6f7fb);
    scene.fog = new THREE.Fog(0xf6f7fb, 28, 86);

    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.05, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.screenSpacePanning = false;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xdbeafe, 1.25));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(8, 14, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);
    const warmInterior = new THREE.PointLight(0xfff1c2, 1.5, Math.max(overrideWidth, overrideDepth) * 2);
    warmInterior.position.set(0, Math.max(2.2, overrideHeight * 0.5), 0);
    scene.add(warmInterior);

    const root = new THREE.Group();
    root.rotation.y = (-overrideRotationDeg * Math.PI) / 180;
    scene.add(root);

    const showBefore = viewMode === 'before' || viewMode === 'compare';
    const showAfter = viewMode === 'after' || viewMode === 'compare';
    const activeLayers = filterLayers(layers, visibleLayers, showBefore, showAfter);
    const renderLayers = activeLayers.length > 0 ? activeLayers : makeFallbackLayers(overrideWidth, overrideDepth);
    const scalePoint = makePlanScaler(renderLayers, overrideWidth, overrideDepth);
    const floorPlate = makeFloorPlate(overrideWidth, overrideDepth);
    const visibleFloors = floors.filter((floor) => visibleFloorIds[floor.id] ?? true);

    visibleFloors.forEach((floor, floorIndex) => {
      const y = exploded ? floorIndex * 3.4 : floor.elevation;
      const plate = createPlate(floorPlate, y, floorIndex === 0 ? 0xe5e7eb : 0xf8fafc, xray ? 0.08 : 0.14);
      plate.receiveShadow = true;
      root.add(plate);

      renderLayers.forEach((layer) => {
        if (visibleLayers[layer.name] === false) return;
        if (!shouldRenderLayerOnFloor(layer, floorIndex)) return;

        const isProposed = isProposedLayer(layer);
        const color = SEMANTIC_COLORS[layer.semantic] || SEMANTIC_COLORS.unknown;
        const opacity = layerOpacity(layer.semantic, isProposed, xray);
        const group = new THREE.Group();

        layer.entities.forEach((entity) => {
          const points = entity.pointsM.map(scalePoint);
          if (points.length < 2) return;

          if (isWallLike(layer.semantic) && !xray) {
            addWallSegments(group, points, y, color, isProposed ? 0.12 : 0.16, Math.min(2.55, Math.max(0.7, overrideHeight / floors.length - 0.15)));
            return;
          }

          if (entity.closed && points.length >= 3 && layer.semantic === 'floors') {
            group.add(createPlate(points, y + 0.025, color, Math.min(opacity, 0.2)));
            return;
          }

          group.add(createPolyline(points, y + 0.06, color, opacity, entity.closed));
        });

        root.add(group);
      });

      if (showAfter) {
        addInteriorSet(root, overrideWidth, overrideDepth, y, floorIndex, xray);
        addFacadeOpenings(root, overrideWidth, overrideDepth, y, floorIndex, xray);
      }
    });

    if (showAfter) {
      const topFloorY = visibleFloors.length > 0 ? (exploded ? (visibleFloors.length - 1) * 3.4 : visibleFloors[visibleFloors.length - 1].elevation) : 0;
      addRoofCanopy(root, overrideWidth, overrideDepth, topFloorY + Math.min(2.9, Math.max(1.2, overrideHeight / floors.length)), xray);
      addSiteContext(root, overrideWidth, overrideDepth);
    }

    const box = new THREE.Box3().setFromObject(root);
    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3());
      const size = Math.max(10, box.getSize(new THREE.Vector3()).length());
      controls.target.copy(center);
      camera.position.copy(center.clone().add(new THREE.Vector3(size * 0.55, size * 0.52, size * 0.72)));
      camera.near = 0.02;
      camera.far = size * 80;
      camera.updateProjectionMatrix();
    } else {
      camera.position.set(10, 8, 12);
    }

    const grid = new THREE.GridHelper(Math.max(12, overrideWidth, overrideDepth) * 1.5, 24, 0x94a3b8, 0xdbe3ee);
    grid.position.y = -0.03;
    scene.add(grid);

    const resize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };

    window.addEventListener('resize', resize);
    let animationFrame = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [
    layers,
    visibleLayers,
    visibleFloorIds,
    viewMode,
    xray,
    exploded,
    overrideHeight,
    overrideWidth,
    overrideDepth,
    overrideRotationDeg,
    floors,
  ]);

  const generatedServices = layers.filter((layer) => layer.generated && SERVICE_SEMANTICS.includes(layer.semantic));

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-black uppercase tracking-wider text-slate-500">
            <Sparkles className="h-4 w-4 text-violet-600" /> Interactive Proposal
          </h2>
          <p className="mt-0.5 text-[10px] font-bold text-slate-400">
            {footprint?.source === 'dxf' 
              ? 'Three.js interactive builder · real CAD vectors · furnished spaces, glass openings, services, roof, and exploded levels'
              : 'Three.js interactive builder · AI-synthesized spatial layout · furnished spaces, services, roof, and exploded levels'
            }
          </p>
          {dxfFile && footprint?.source === 'dxf' ? (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span>3D model built from uploaded CAD file: <span className="underline">{dxfFile.name}</span></span>
            </div>
          ) : (existingImageFile || proposedImageFile) ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {existingImageFile && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-bold text-slate-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500 shrink-0" />
                  <span>Existing Plan: <span className="underline">{existingImageFile.name}</span></span>
                </div>
              )}
              {proposedImageFile && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[9px] font-bold text-violet-700">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-500"></span>
                  </span>
                  <span>Proposed Plan: <span className="underline">{proposedImageFile.name}</span> ({application.extractedData?.propertyType || 'Semi-detached'} {application.extractedData?.extensionType || 'rear'} extension, {overrideWidth.toFixed(1)}m × {overrideDepth.toFixed(1)}m)</span>
                </div>
              )}
            </div>
          ) : imageFile ? (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[9px] font-bold text-violet-700">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-500"></span>
              </span>
              <span>Synthesized based on uploaded plan drawing: <span className="underline">{imageFile.name}</span> ({application.extractedData?.propertyType || 'Semi-detached'} {application.extractedData?.extensionType || 'rear'} extension, {overrideWidth.toFixed(1)}m × {overrideDepth.toFixed(1)}m)</span>
            </div>
          ) : (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-[9px] font-bold text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
              <span>Schematic fallback model based on project description</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <ModeButton active={viewMode === 'before'} onClick={() => setViewMode('before')} label="Before" />
          <ModeButton active={viewMode === 'after'} onClick={() => setViewMode('after')} label="After" />
          <ModeButton active={viewMode === 'compare'} onClick={() => setViewMode('compare')} label="Compare" />
          <button onClick={() => setXray((value) => !value)} className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-wider ${xray ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-zinc-200 bg-white text-slate-600'}`}>
            <Eye className="h-3.5 w-3.5" /> X-ray
          </button>
          <button onClick={() => setExploded((value) => !value)} className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-wider ${exploded ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-zinc-200 bg-white text-slate-600'}`}>
            <Move3D className="h-3.5 w-3.5" /> Floors
          </button>
          <button 
            onClick={() => setIsControlModalOpen(true)} 
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 text-[10px] font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer"
          >
            <Layers3 className="h-3.5 w-3.5" /> Floors &amp; CAD Layers
          </button>
        </div>
      </div>

      <div className="relative">
        <div className="h-[680px] overflow-hidden rounded-2xl border border-zinc-200 bg-slate-50 shadow-sm w-full" ref={mountRef} />

        {/* Modal Overlay for Controls */}
        {isControlModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
            <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <Layers3 className="w-4 h-4 text-violet-600" /> Floors &amp; CAD Layers
                </span>
                <button 
                  onClick={() => setIsControlModalOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="space-y-5">
                <ControlGroup title="Floors">
                  <div className="grid grid-cols-2 gap-2">
                    {floors.map((floor) => (
                      <label key={floor.id} className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-100 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100/50 transition-colors">
                        <span>{floor.label}</span>
                        <input
                          type="checkbox"
                          checked={visibleFloorIds[floor.id] ?? true}
                          onChange={(event) => setVisibleFloorIds((current) => ({ ...current, [floor.id]: event.target.checked }))}
                          className="accent-violet-600"
                        />
                      </label>
                    ))}
                  </div>
                </ControlGroup>

                <ControlGroup title="CAD Layers">
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1 border border-slate-100 rounded-xl p-2 bg-slate-50/30">
                    {layers.map((layer) => (
                      <label key={layer.name} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-zinc-100/50 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
                        <input
                          type="checkbox"
                          checked={visibleLayers[layer.name] ?? layer.semantic !== 'annotation'}
                          onChange={(event) => setVisibleLayers((current) => ({ ...current, [layer.name]: event.target.checked }))}
                          className="accent-violet-600"
                        />
                        <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: toCssColor(SEMANTIC_COLORS[layer.semantic]) }} />
                        <span className="min-w-0 flex-1 truncate" title={layer.name}>{layer.name}</span>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold shrink-0">{layer.generated ? 'demo' : layer.semantic}</span>
                      </label>
                    ))}
                  </div>
                </ControlGroup>

                <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-[10px] font-bold text-slate-500">
                  <Metric label="Footprint Sizing" value={`${overrideWidth.toFixed(1)}m x ${overrideDepth.toFixed(1)}m`} />
                  <Metric label="Floors Count" value={`${floors.length}`} />
                  <Metric label="Total Height" value={`${overrideHeight.toFixed(1)}m`} />
                  <Metric label="Rotation Angle" value={`${overrideRotationDeg.toFixed(0)} deg`} />
                  <Metric label="Plan Confidence" value={footprint?.parserConfidence || 'schematic fallback'} />
                </div>

                {generatedServices.length > 0 && (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-[10px] font-bold leading-relaxed text-sky-800">
                    Full-demo overlay active: generated electrical, lighting, plumbing, and HVAC routes are shown because this proposal did not contain every service layer.
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setIsControlModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-md shadow-slate-950/10 cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ModeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-wider ${active ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-zinc-200 bg-white text-slate-500'}`}>
      <RotateCcw className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function ControlGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <span className="text-slate-800">{value}</span>
    </div>
  );
}


function filterLayers(layers: RenderLayer[], visibleLayers: Record<string, boolean>, showBefore: boolean, showAfter: boolean) {
  return layers.filter((layer) => {
    if (visibleLayers[layer.name] === false) return false;
    if (isProposedLayer(layer)) return showAfter;
    if (isExistingLayer(layer)) return showBefore;
    return showBefore || showAfter;
  });
}

function isProposedLayer(layer: RenderLayer) {
  return layer.generated || layer.semantic === 'proposed' || PROPOSED_HINTS.test(layer.name.replace(/[_-]+/g, ' '));
}

function isExistingLayer(layer: RenderLayer) {
  return layer.semantic === 'existing' || layer.semantic === 'walls' || layer.semantic === 'demolition' || EXISTING_HINTS.test(layer.name.replace(/[_-]+/g, ' '));
}

function buildFloors(height: number) {
  const count = Math.max(1, Math.min(4, Math.ceil(height / 3)));
  return Array.from({ length: count }, (_, index) => ({
    id: `floor-${index}`,
    label: index === 0 ? 'Ground floor' : index === 1 ? 'First floor' : `Floor ${index + 1}`,
    elevation: index * 3,
  }));
}

function shouldRenderLayerOnFloor(layer: RenderLayer, floorIndex: number) {
  if (layer.semantic === 'roof') return floorIndex > 0;
  if (layer.semantic === 'furniture' || layer.semantic === 'annotation') return floorIndex === 0;
  return true;
}

function isWallLike(semantic: Semantic) {
  return semantic === 'walls' || semantic === 'existing' || semantic === 'proposed';
}

function layerOpacity(semantic: Semantic, isProposed: boolean, xray: boolean) {
  if (xray) return 0.28;
  if (isProposed) return 0.62;
  if (SERVICE_SEMANTICS.includes(semantic)) return 0.95;
  if (semantic === 'annotation') return 0.5;
  return 0.82;
}

function createPolyline(points: Array<{ x: number; y: number }>, y: number, color: number, opacity: number, closed?: boolean) {
  const linePoints = [...points, ...(closed ? [points[0]] : [])].map((point) => new THREE.Vector3(point.x, y, point.y));
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(linePoints),
    new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity })
  );
}

function createPlate(points: Array<{ x: number; y: number }>, y: number, color: number, opacity: number) {
  const shape = new THREE.Shape(points.map((point) => new THREE.Vector2(point.x, -point.y)));
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, roughness: 0.9 })
  );
  mesh.position.y = y;
  return mesh;
}

function addWallSegments(group: THREE.Group, points: Array<{ x: number; y: number }>, baseY: number, color: number, thickness: number, height: number) {
  const path = [...points, points[0]];
  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index];
    const end = path[index + 1];
    const dx = end.x - start.x;
    const dz = end.y - start.y;
    const length = Math.hypot(dx, dz);
    if (length < 0.05) continue;

    const geometry = new THREE.BoxGeometry(length, height, thickness);
    const material = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.78, roughness: 0.65 });
    const wall = new THREE.Mesh(geometry, material);
    wall.position.set((start.x + end.x) / 2, baseY + height / 2, (start.y + end.y) / 2);
    wall.rotation.y = -Math.atan2(dz, dx);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
  }
}

function addInteriorSet(root: THREE.Group, width: number, depth: number, baseY: number, floorIndex: number, xray: boolean) {
  if (floorIndex > 1) return;
  const group = new THREE.Group();
  const y = baseY + 0.08;
  const opacity = xray ? 0.34 : 1;

  addBox(group, width * -0.22, y + 0.2, depth * 0.08, width * 0.2, 0.4, depth * 0.13, 0x0f766e, opacity);
  addBox(group, width * -0.22, y + 0.58, depth * 0.08, width * 0.17, 0.12, depth * 0.1, 0x99f6e4, opacity);
  addBox(group, width * -0.34, y + 0.43, depth * 0.08, width * 0.04, 0.46, depth * 0.12, 0x134e4a, opacity);
  addBox(group, width * -0.1, y + 0.43, depth * 0.08, width * 0.04, 0.46, depth * 0.12, 0x134e4a, opacity);

  addBox(group, width * 0.23, y + 0.42, depth * -0.18, width * 0.2, 0.16, depth * 0.12, 0xf8fafc, opacity);
  addBox(group, width * 0.23, y + 0.22, depth * -0.18, width * 0.15, 0.28, depth * 0.08, 0x475569, opacity);
  addCylinder(group, width * 0.13, y + 0.24, depth * -0.18, 0.06, 0.42, 0x334155, opacity);
  addCylinder(group, width * 0.33, y + 0.24, depth * -0.18, 0.06, 0.42, 0x334155, opacity);

  addBox(group, width * 0.28, y + 0.46, depth * 0.24, width * 0.28, 0.55, depth * 0.1, 0xa16207, opacity);
  addBox(group, width * 0.28, y + 0.82, depth * 0.24, width * 0.22, 0.1, depth * 0.08, 0xfde68a, opacity);
  addBox(group, width * 0.42, y + 0.42, depth * 0.05, width * 0.08, 0.72, depth * 0.28, 0xe2e8f0, opacity);

  addBox(group, width * -0.38, y + 0.46, depth * -0.26, width * 0.16, 0.72, depth * 0.11, 0x1d4ed8, opacity);
  addBox(group, width * -0.38, y + 0.9, depth * -0.26, width * 0.13, 0.1, depth * 0.09, 0xbfdbfe, opacity);

  for (let index = 0; index < 4; index += 1) {
    const angle = (index / 4) * Math.PI * 2;
    addCylinder(group, Math.cos(angle) * width * 0.16, y + 1.75, Math.sin(angle) * depth * 0.16, 0.08, 0.08, 0xfff7ed, xray ? 0.5 : 1);
  }

  root.add(group);
}

function addFacadeOpenings(root: THREE.Group, width: number, depth: number, baseY: number, floorIndex: number, xray: boolean) {
  const glass = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: xray ? 0.18 : 0.5,
    roughness: 0.1,
    metalness: 0.05,
  });
  const door = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7, transparent: xray, opacity: xray ? 0.3 : 1 });
  const y = baseY + 1.25;
  const specs = [
    { x: -width * 0.18, z: -depth / 2 - 0.02, w: width * 0.2, h: 1.15, mat: glass },
    { x: width * 0.2, z: -depth / 2 - 0.02, w: width * 0.22, h: 1.15, mat: glass },
    { x: -width / 2 - 0.02, z: depth * 0.12, w: depth * 0.22, h: 1.05, mat: glass, side: true },
  ];

  specs.forEach((spec) => {
    const geometry = spec.side ? new THREE.BoxGeometry(0.04, spec.h, spec.w) : new THREE.BoxGeometry(spec.w, spec.h, 0.04);
    const mesh = new THREE.Mesh(geometry, spec.mat);
    mesh.position.set(spec.x, y, spec.z);
    root.add(mesh);
  });

  if (floorIndex === 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width * 0.14, 2.05, 0.08), door);
    mesh.position.set(width * 0.03, baseY + 1.02, depth / 2 + 0.03);
    mesh.castShadow = true;
    root.add(mesh);
  }
}

function addRoofCanopy(root: THREE.Group, width: number, depth: number, y: number, xray: boolean) {
  const group = new THREE.Group();
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.08, 0.18, depth * 1.08),
    new THREE.MeshStandardMaterial({ color: 0x334155, transparent: true, opacity: xray ? 0.18 : 0.82, roughness: 0.75 })
  );
  roof.position.y = y + 0.12;
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  const skylight = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.24, 0.04, depth * 0.22),
    new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.55, roughness: 0.05 })
  );
  skylight.position.set(width * -0.2, y + 0.24, depth * 0.08);
  group.add(skylight);
  root.add(group);
}

function addSiteContext(root: THREE.Group, width: number, depth: number) {
  const paving = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.22, 0.04, depth * 1.18),
    new THREE.MeshStandardMaterial({ color: 0xd9e2ec, roughness: 0.95 })
  );
  paving.position.y = -0.08;
  paving.receiveShadow = true;
  root.add(paving);

  const garden = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.35, 0.025, depth * 0.24),
    new THREE.MeshStandardMaterial({ color: 0x86efac, roughness: 0.9 })
  );
  garden.position.set(0, -0.055, depth * 0.72);
  root.add(garden);
}

function addBox(group: THREE.Group, x: number, y: number, z: number, width: number, height: number, depth: number, color: number, opacity: number) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(width, 0.08), Math.max(height, 0.08), Math.max(depth, 0.08)),
    new THREE.MeshStandardMaterial({ color, roughness: 0.58, transparent: opacity < 1, opacity })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
}

function addCylinder(group: THREE.Group, x: number, y: number, z: number, radius: number, height: number, color: number, opacity: number) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 24),
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, transparent: opacity < 1, opacity })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  group.add(mesh);
}

function makePlanScaler(layers: RenderLayer[], targetWidth: number, targetDepth: number) {
  const points = layers.flatMap((layer) => layer.entities.flatMap((entity) => entity.pointsM));
  if (points.length === 0) return (point: { x: number; y: number }) => point;

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const depth = Math.max(...ys) - Math.min(...ys);
  const scaleX = width > 0 ? targetWidth / width : 1;
  const scaleY = depth > 0 ? targetDepth / depth : 1;

  return (point: { x: number; y: number }) => ({
    x: point.x * scaleX,
    y: point.y * scaleY,
  });
}

function makeFloorPlate(width: number, depth: number) {
  return [
    { x: -width / 2, y: -depth / 2 },
    { x: width / 2, y: -depth / 2 },
    { x: width / 2, y: depth / 2 },
    { x: -width / 2, y: depth / 2 },
  ];
}

function makeFallbackLayers(width: number, depth: number): RenderLayer[] {
  return [
    {
      name: 'Existing schematic floor plate',
      semantic: 'existing',
      entityCount: 1,
      entities: [{ type: 'LWPOLYLINE', closed: true, pointsM: makeFloorPlate(width, depth) }],
    },
    {
      name: 'After proposal from description',
      semantic: 'proposed',
      entityCount: 1,
      entities: [{ type: 'LWPOLYLINE', closed: true, pointsM: makeFloorPlate(width, depth) }],
    },
  ];
}

function normalizeLayers(layers: StructuralLayer[], width: number, depth: number): RenderLayer[] {
  const normalized = layers.map((layer) => ({
    ...layer,
    semantic: classifyLayerForDisplay(layer.name, layer.semantic),
  }));
  const presentServices = new Set(normalized.map((layer) => layer.semantic));
  const generated = SERVICE_SEMANTICS
    .filter((semantic) => !presentServices.has(semantic))
    .map((semantic) => makeGeneratedServiceLayer(semantic, width, depth));

  return [...normalized, ...generated];
}

function classifyLayerForDisplay(layerName: string, stored: Semantic): Semantic {
  const normalized = layerName.toLowerCase().replace(/[_-]+/g, ' ');
  if (PROPOSED_HINTS.test(normalized)) return 'proposed';
  if (EXISTING_HINTS.test(normalized)) return 'existing';
  if (WALL_HINTS.test(normalized)) return 'walls';
  if (OPENING_HINTS.test(normalized)) return 'openings';
  if (FLOOR_HINTS.test(normalized)) return 'floors';
  if (ROOF_HINTS.test(normalized)) return 'roof';
  if (/\b(elec|electrical|power|socket|outlet|cable)\b/.test(normalized)) return 'electrical';
  if (/\b(light|lighting|luminaire|lamp)\b/.test(normalized)) return 'lighting';
  if (/\b(plumb|water|drain|pipe|waste|sanitary)\b/.test(normalized)) return 'plumbing';
  if (/\b(hvac|duct|vent|heating|cooling|mechanical)\b/.test(normalized)) return 'hvac';
  if (/\b(furniture|furn|fixture|sanitary|kitchen)\b/.test(normalized)) return 'furniture';
  if (/\b(text|note|annotation|label|dimension|dim|arrow|border)\b/.test(normalized)) return 'annotation';
  return stored;
}

function makeGeneratedServiceLayer(semantic: Semantic, width: number, depth: number): RenderLayer {
  const marginX = width * 0.18;
  const marginY = depth * 0.18;
  const routes: Record<string, Array<{ x: number; y: number }>> = {
    electrical: [
      { x: -width / 2 + marginX, y: -depth * 0.18 },
      { x: width / 2 - marginX, y: -depth * 0.18 },
    ],
    lighting: [
      { x: -width / 2 + marginX, y: depth * 0.18 },
      { x: width / 2 - marginX, y: depth * 0.18 },
    ],
    plumbing: [
      { x: width * 0.16, y: -depth / 2 + marginY },
      { x: width * 0.16, y: depth / 2 - marginY },
    ],
    hvac: [
      { x: -width / 2 + marginX, y: depth / 2 - marginY },
      { x: width / 2 - marginX, y: depth / 2 - marginY },
    ],
  };

  return {
    name: `DEMO_${semantic.toUpperCase()}_ROUTE`,
    semantic,
    generated: true,
    entityCount: 1,
    entities: [{ type: 'LINE', pointsM: routes[semantic] || routes.electrical }],
  };
}

function toCssColor(value: number) {
  return `#${value.toString(16).padStart(6, '0')}`;
}

function generateSchematicLayers(propertyType: string, extensionType: string, width: number, depth: number): StructuralLayer[] {
  const layers: StructuralLayer[] = [];

  // Existing house sizing
  const hw = 8;
  const hd = 7;
  const exWalls = [
    { x: -hw / 2, y: -hd / 2 },
    { x: hw / 2, y: -hd / 2 },
    { x: hw / 2, y: hd / 2 },
    { x: -hw / 2, y: hd / 2 },
  ];

  layers.push({
    name: 'EXISTING_OUTER_WALLS',
    semantic: 'existing',
    entityCount: 1,
    entities: [{ type: 'LWPOLYLINE', closed: true, pointsM: exWalls }],
  });

  // Inner partition walls
  layers.push({
    name: 'EXISTING_PARTITION_WALLS',
    semantic: 'existing',
    entityCount: 2,
    entities: [
      { type: 'LINE', pointsM: [{ x: -hw / 2 + 3, y: -hd / 2 }, { x: -hw / 2 + 3, y: hd / 2 - 1.5 }] },
      { type: 'LINE', pointsM: [{ x: -hw / 2 + 3, y: hd / 2 - 1.5 }, { x: hw / 2, y: hd / 2 - 1.5 }] },
    ],
  });

  const extType = extensionType.toLowerCase();

  if (extType === 'side') {
    const extW = width;
    const extD = Math.min(hd, depth);
    const xMin = hw / 2;
    const xMax = hw / 2 + extW;
    const yMin = -hd / 2;
    const yMax = -hd / 2 + extD;

    layers.push({
      name: 'PROPOSED_EXTENSION_WALLS',
      semantic: 'proposed',
      entityCount: 1,
      entities: [{
        type: 'LWPOLYLINE',
        closed: false,
        pointsM: [
          { x: xMin, y: yMin },
          { x: xMax, y: yMin },
          { x: xMax, y: yMax },
          { x: xMin, y: yMax },
        ],
      }],
    });

    layers.push({
      name: 'DEMOLITION_WALLS',
      semantic: 'demolition',
      entityCount: 1,
      entities: [{
        type: 'LINE',
        pointsM: [
          { x: xMin, y: yMin },
          { x: xMin, y: yMax },
        ],
      }],
    });

    layers.push({
      name: 'PROPOSED_FLOORS',
      semantic: 'floors',
      entityCount: 1,
      entities: [{
        type: 'LWPOLYLINE',
        closed: true,
        pointsM: [
          { x: xMin, y: yMin },
          { x: xMax, y: yMin },
          { x: xMax, y: yMax },
          { x: xMin, y: yMax },
        ],
      }],
    });

    layers.push({
      name: 'PROPOSED_OPENINGS',
      semantic: 'openings',
      entityCount: 1,
      entities: [{
        type: 'LINE',
        pointsM: [
          { x: xMax, y: yMin + extD * 0.3 },
          { x: xMax, y: yMin + extD * 0.7 },
        ],
      }],
    });

    layers.push({
      name: 'PROPOSED_DESK',
      semantic: 'furniture',
      entityCount: 1,
      entities: [{
        type: 'LWPOLYLINE',
        closed: true,
        pointsM: [
          { x: xMax - extW * 0.2, y: yMin + extD * 0.2 },
          { x: xMax - 0.1, y: yMin + extD * 0.2 },
          { x: xMax - 0.1, y: yMin + extD * 0.5 },
          { x: xMax - extW * 0.2, y: yMin + extD * 0.5 },
        ],
      }],
    });
  } else if (extType === 'loft') {
    const extW = width;
    const extD = depth;
    const xMin = -extW / 2;
    const xMax = extW / 2;
    const yMin = -extD / 2;
    const yMax = extD / 2;

    layers.push({
      name: 'PROPOSED_DORMER_WALLS',
      semantic: 'proposed',
      entityCount: 1,
      entities: [{
        type: 'LWPOLYLINE',
        closed: false,
        pointsM: [
          { x: xMin, y: yMin },
          { x: xMin, y: yMax },
          { x: xMax, y: yMax },
          { x: xMax, y: yMin },
        ],
      }],
    });

    layers.push({
      name: 'PROPOSED_FLOORS',
      semantic: 'floors',
      entityCount: 1,
      entities: [{
        type: 'LWPOLYLINE',
        closed: true,
        pointsM: [
          { x: xMin, y: yMin },
          { x: xMax, y: yMin },
          { x: xMax, y: yMax },
          { x: xMin, y: yMax },
        ],
      }],
    });

    layers.push({
      name: 'PROPOSED_BED',
      semantic: 'furniture',
      entityCount: 1,
      entities: [{
        type: 'LWPOLYLINE',
        closed: true,
        pointsM: [
          { x: xMin + 0.5, y: yMin + 0.5 },
          { x: xMin + 2.1, y: yMin + 0.5 },
          { x: xMin + 2.1, y: yMin + 2.3 },
          { x: xMin + 0.5, y: yMin + 2.3 },
        ],
      }],
    });
  } else {
    // rear extension (default)
    const extW = width;
    const extD = depth;
    const xMin = -extW / 2;
    const xMax = extW / 2;
    const yMin = hd / 2;
    const yMax = hd / 2 + extD;

    layers.push({
      name: 'PROPOSED_EXTENSION_WALLS',
      semantic: 'proposed',
      entityCount: 1,
      entities: [{
        type: 'LWPOLYLINE',
        closed: false,
        pointsM: [
          { x: xMin, y: yMin },
          { x: xMin, y: yMax },
          { x: xMax, y: yMax },
          { x: xMax, y: yMin },
        ],
      }],
    });

    layers.push({
      name: 'DEMOLITION_WALLS',
      semantic: 'demolition',
      entityCount: 1,
      entities: [{
        type: 'LINE',
        pointsM: [
          { x: Math.max(-hw / 2, xMin), y: yMin },
          { x: Math.min(hw / 2, xMax), y: yMin },
        ],
      }],
    });

    layers.push({
      name: 'PROPOSED_FLOORS',
      semantic: 'floors',
      entityCount: 1,
      entities: [{
        type: 'LWPOLYLINE',
        closed: true,
        pointsM: [
          { x: xMin, y: yMin },
          { x: xMax, y: yMin },
          { x: xMax, y: yMax },
          { x: xMin, y: yMax },
        ],
      }],
    });

    layers.push({
      name: 'PROPOSED_OPENINGS_BIFOLD',
      semantic: 'openings',
      entityCount: 1,
      entities: [{
        type: 'LINE',
        pointsM: [
          { x: xMin + extW * 0.15, y: yMax },
          { x: xMax - extW * 0.15, y: yMax },
        ],
      }],
    });

    layers.push({
      name: 'PROPOSED_KITCHEN_ISLAND',
      semantic: 'furniture',
      entityCount: 1,
      entities: [{
        type: 'LWPOLYLINE',
        closed: true,
        pointsM: [
          { x: xMin + extW * 0.2, y: yMin + extD * 0.2 },
          { x: xMin + extW * 0.4, y: yMin + extD * 0.2 },
          { x: xMin + extW * 0.4, y: yMin + extD * 0.5 },
          { x: xMin + extW * 0.2, y: yMin + extD * 0.5 },
        ],
      }],
    });

    layers.push({
      name: 'PROPOSED_DINING_TABLE',
      semantic: 'furniture',
      entityCount: 1,
      entities: [{
        type: 'LWPOLYLINE',
        closed: true,
        pointsM: [
          { x: xMax - extW * 0.4, y: yMin + extD * 0.3 },
          { x: xMax - extW * 0.15, y: yMin + extD * 0.3 },
          { x: xMax - extW * 0.15, y: yMin + extD * 0.65 },
          { x: xMax - extW * 0.4, y: yMin + extD * 0.65 },
        ],
      }],
    });
  }

  // Existing openings & furniture (living room layout)
  layers.push({
    name: 'EXISTING_OPENINGS_DOOR',
    semantic: 'openings',
    entityCount: 1,
    entities: [{ type: 'LINE', pointsM: [{ x: hw / 2 - 1.5, y: -hd / 2 }, { x: hw / 2 - 0.5, y: -hd / 2 }] }],
  });

  layers.push({
    name: 'EXISTING_OPENINGS_WINDOW',
    semantic: 'openings',
    entityCount: 1,
    entities: [{ type: 'LINE', pointsM: [{ x: -hw / 2 + 1, y: -hd / 2 }, { x: -hw / 2 + 2, y: -hd / 2 }] }],
  });

  layers.push({
    name: 'EXISTING_SOFA',
    semantic: 'furniture',
    entityCount: 1,
    entities: [{
      type: 'LWPOLYLINE',
      closed: true,
      pointsM: [
        { x: -hw / 2 + 3.5, y: -hd / 2 + 1 },
        { x: hw / 2 - 1, y: -hd / 2 + 1 },
        { x: hw / 2 - 1, y: -hd / 2 + 2.5 },
        { x: -hw / 2 + 3.5, y: -hd / 2 + 2.5 },
      ],
    }],
  });

  return layers;
}
