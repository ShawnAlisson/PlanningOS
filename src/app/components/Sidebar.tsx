'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  FileText,
  Layers,
  ShieldCheck,
  Loader2,
  ExternalLink,
  PlusCircle,
} from 'lucide-react';
import { Application } from '@/lib/types';
import { UK_PLANNING_SOURCES } from '@/lib/uk-sources';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [preloading, setPreloading] = useState<string | null>(null);

  // Fetch applications list
  const fetchApps = async () => {
    try {
      const res = await fetch('/api/applications');
      const data = await res.json();
      setApplications(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    void fetchApps();
    // Poll applications list periodically to update status if any are processing
    const interval = setInterval(() => {
      void fetchApps();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Demo payloads intentionally omit conservationZone/floodZone/highwaysProximity:
  // those are now derived live from planning.data.gov.uk for the real postcode below,
  // instead of being hardcoded. Only project-specific facts (what is being built) are preset.
  const handlePreloadDemo = async (type: 'loft' | 'heritage' | 'flood') => {
    setPreloading(type);
    let payload = {};

    if (type === 'loft') {
      payload = {
        title: 'Full DXF Householder Extension Demo',
        address: '12 Grove Vale, London SE22 8QZ',
        description:
          'Full-service DXF demo for a two storey rear extension, 5m high, with existing walls, proposed extension, openings, furniture, electrical power, lighting, plumbing waste, and HVAC vent routes. Includes overlooking risk and construction close to the highway.',
        sourceMode: 'demo',
        sourceNote: 'Full DXF demo: real postcode, live-derived constraints, uploaded CAD fixture with floor/service layers.',
        files: [
          { name: 'full-service-house-plan.dxf', url: '/demos/full-service-house-plan.dxf', size: 12000, type: 'application/dxf' },
        ],
        extractedData: {
          propertyType: 'Semi-detached',
          extensionType: 'rear',
          proposedHeight: 5,
          proposedVolume: 55,
          neighbourImpactLevel: 'high',
        },
      };
    } else if (type === 'heritage') {
      payload = {
        title: 'Conservation Area Rear Extension',
        address: '12 Regency Gate, Bath BA1 5HG',
        description: 'Construction of a single-storey rear extension and timber sash windows replacement in central Bath.',
        sourceMode: 'demo',
        sourceNote: 'Demo record: real postcode, live-derived constraints. Bath city centre reliably intersects real conservation-area records.',
        files: [
          { name: 'Heritage_Impact_Statement.pdf', url: '#', size: 2048576, type: 'application/pdf' },
          { name: 'Elevation_Plans_v3.pdf', url: '#', size: 1536000, type: 'application/pdf' },
        ],
        extractedData: {
          propertyType: 'Terraced',
          extensionType: 'rear',
          proposedHeight: 3.9,
          proposedVolume: 42,
          neighbourImpactLevel: 'medium',
        },
      };
    } else {
      payload = {
        title: 'Riverside Rebuild & Annex',
        address: '2 Severnside South, Bewdley DY12 2DZ',
        description: 'Proposed detached residential annex with home office and garage in the Severnside flood corridor.',
        sourceMode: 'demo',
        sourceNote: 'Demo record: real postcode, live-derived constraints. Bewdley reliably intersects real Environment Agency flood-risk-zone records.',
        files: [
          { name: 'Site_Plan_Map.pdf', url: '#', size: 3145728, type: 'application/pdf' },
          { name: 'Drainage_Strategy_v1.pdf', url: '#', size: 820000, type: 'application/pdf' },
        ],
        extractedData: {
          propertyType: 'Detached',
          extensionType: 'rear',
          proposedHeight: 4.2,
          proposedVolume: 55,
          neighbourImpactLevel: 'high',
        },
      };
    }

    try {
      const res = type === 'loft'
        ? await submitDxfDemo(payload)
        : await fetch('/api/applications/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      const newApp = await res.json();
      router.push(`/processing/${newApp.id}`);
    } catch (e) {
      console.error(e);
    } finally {
      setPreloading(null);
    }
  };

  return (
    <div className="p-6 space-y-8 flex flex-col">
      
      {/* 1. Guided Demos Section */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          <Layers className="w-4 h-4 text-violet-500" />
          <span>Onboarding Demos</span>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => handlePreloadDemo('loft')}
            disabled={preloading !== null}
            className="flex flex-col text-left p-3 rounded-xl border border-zinc-250 bg-zinc-50/50 hover:border-violet-500/30 hover:bg-violet-50/15 transition-all text-xs font-semibold group cursor-pointer disabled:opacity-50"
          >
            <span className="text-slate-800 group-hover:text-violet-600 transition-colors">1. Full DXF BIM Demo</span>
            <span className="text-[10px] text-slate-400 mt-1 line-clamp-1">Before/after floors, services, and real postcode.</span>
          </button>

          <button
            onClick={() => handlePreloadDemo('heritage')}
            disabled={preloading !== null}
            className="flex flex-col text-left p-3 rounded-xl border border-zinc-250 bg-zinc-50/50 hover:border-amber-500/30 hover:bg-amber-50/15 transition-all text-xs font-semibold group cursor-pointer disabled:opacity-50"
          >
            <span className="text-slate-800 group-hover:text-amber-600 transition-colors">2. Heritage Area Conflict</span>
            <span className="text-[10px] text-slate-400 mt-1 line-clamp-1">Triggers strict heritage conservation policy.</span>
          </button>

          <button
            onClick={() => handlePreloadDemo('flood')}
            disabled={preloading !== null}
            className="flex flex-col text-left p-3 rounded-xl border border-zinc-250 bg-zinc-50/50 hover:border-rose-500/30 hover:bg-rose-50/15 transition-all text-xs font-semibold group cursor-pointer disabled:opacity-50"
          >
            <span className="text-slate-800 group-hover:text-rose-600 transition-colors">3. Flood Zone 3 Rebuild</span>
            <span className="text-[10px] text-slate-400 mt-1 line-clamp-1">High-risk flood and neighbour impact.</span>
          </button>
        </div>
      </div>

      {/* 2. Active & Past Applications */}
      <div className="space-y-4 flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <FileText className="w-4 h-4 text-violet-500" />
            <span>Applications List</span>
          </div>
          <Link href="/" className="text-[10px] font-bold text-violet-600 hover:text-violet-700 flex items-center space-x-0.5">
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New</span>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-6 text-zinc-400 space-x-2">
            <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
            <span className="text-xs font-medium">Fetching registry...</span>
          </div>
        ) : applications.length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-6 font-semibold">No submissions recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
            {applications.map((app) => {
              const active = pathname.includes(app.id);
              return (
                <Link
                  key={app.id}
                  href={app.status === 'completed' ? `/review/${app.id}` : `/processing/${app.id}`}
                  className={`block p-3 rounded-xl border transition-all text-xs ${
                    active
                      ? 'border-violet-500 bg-violet-50/50 shadow-sm font-bold'
                      : 'border-zinc-200/70 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 truncate max-w-[70%]">{app.title}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                        app.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : app.status === 'processing'
                          ? 'bg-violet-50 text-violet-700 animate-pulse'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {app.status.slice(0, 4)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-1">{app.address}</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Official UK Planning Sources Reference list */}
      <div className="space-y-3 pt-4 border-t border-zinc-200/50">
        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Integrated Cites</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {Object.values(UK_PLANNING_SOURCES).map((source) => (
            <a
              key={source.reference}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 transition-colors text-[10px] font-semibold text-slate-700 group"
            >
              <span className="truncate max-w-[90%]">{source.reference}</span>
              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-violet-500 transition-colors" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

async function submitDxfDemo(payload: unknown) {
  const dxfRes = await fetch('/demos/full-service-house-plan.dxf');
  if (!dxfRes.ok) throw new Error('Could not load bundled DXF demo asset');

  const dxfBlob = await dxfRes.blob();
  const form = new FormData();
  form.append('metadata', JSON.stringify(payload));
  form.append('files', new File([dxfBlob], 'full-service-house-plan.dxf', { type: 'application/dxf' }));

  return fetch('/api/applications/upload', { method: 'POST', body: form });
}
