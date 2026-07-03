'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  ArrowRight,
  Loader2,
  MapPin,
  ShieldCheck,
  Search,
  Check,
  Building2,
  Upload,
  Info,
  ChevronRight,
  ArrowLeft,
  Landmark,
  Waves,
  TreeDeciduous,
  AlertTriangle,
} from 'lucide-react';
import { Application } from '@/lib/types';

interface PostcodeSuggestion {
  postcode: string;
  adminDistrict: string | null;
  adminWard: string | null;
  region: string | null;
  latitude: number;
  longitude: number;
}

interface ConstraintSummary {
  geo: {
    lat: number;
    lng: number;
    postcode?: string;
    adminDistrict?: string | null;
    adminWard?: string | null;
    region?: string | null;
    parliamentaryConstituency?: string | null;
  };
  floodZone: string;
  constraints: {
    conservationAreas: { name: string; entityUrl: string }[];
    listedBuildings: { name: string; listedBuildingGrade?: string; entityUrl: string }[];
    floodRiskZones: { name: string; floodRiskType?: string; floodRiskLevel?: string; entityUrl: string }[];
    greenBelt: { name: string; entityUrl: string }[];
    article4Directions: { name: string; entityUrl: string }[];
    totalConstraints: number;
  };
}

const DEMO_POSTCODES = [
  { postcode: 'SE22 8QZ', note: 'Typical South London householder case' },
  { postcode: 'BA1 5HG', note: 'Bath — heritage-dense city centre' },
  { postcode: 'SL6 1AP', note: 'Maidenhead — river/flood corridor' },
];

export default function Dashboard() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);

  const [wizardStep, setWizardStep] = useState(1);
  const [postcodeQuery, setPostcodeQuery] = useState('');
  const [postcodeSuggestions, setPostcodeSuggestions] = useState<PostcodeSuggestion[]>([]);
  const [searchingPostcode, setSearchingPostcode] = useState(false);
  const [selectedPostcode, setSelectedPostcode] = useState<PostcodeSuggestion | null>(null);

  const [constraints, setConstraints] = useState<ConstraintSummary | null>(null);
  const [loadingConstraints, setLoadingConstraints] = useState(false);

  const [houseLine, setHouseLine] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fileRoles, setFileRoles] = useState<Record<string, 'existing' | 'proposed' | 'drawing' | 'other'>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [neighbourImpactLevel, setNeighbourImpactLevel] = useState<'low' | 'medium' | 'high'>('low');
  const [submitting, setSubmitting] = useState(false);

  // Real, live UK postcode search (proxied server-side to postcodes.io - no API key, no fabricated data).
  useEffect(() => {
    const query = postcodeQuery.trim();
    if (query.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing suggestions when the query is cleared is a direct state sync, not a side effect
      setPostcodeSuggestions([]);
      return;
    }

    const controller = new AbortController();
    setSearchingPostcode(true);

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geo/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = await res.json();
        setPostcodeSuggestions(data.results || []);
      } catch {
        // aborted or network issue - ignore
      } finally {
        setSearchingPostcode(false);
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [postcodeQuery]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch('/api/applications');
        const data = await res.json();
        if (active) {
          setApplications(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error(e);
        if (active) {
          setApplications([]);
        }
      } finally {
        if (active) setLoadingApps(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectPostcode = async (suggestion: PostcodeSuggestion) => {
    setSelectedPostcode(suggestion);
    setPostcodeQuery(suggestion.postcode);
    setWizardStep(2);
    setLoadingConstraints(true);
    setConstraints(null);

    try {
      const res = await fetch(`/api/geo/constraints?postcode=${encodeURIComponent(suggestion.postcode)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load constraints');
      setConstraints(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingConstraints(false);
    }
  };

  const loadDemoPostcode = async (postcode: string) => {
    setPostcodeQuery(postcode);
    const res = await fetch(`/api/geo/search?q=${encodeURIComponent(postcode)}`);
    const data = await res.json();
    const match: PostcodeSuggestion | undefined = data.results?.find((r: PostcodeSuggestion) => r.postcode.replace(/\s+/g, '') === postcode.replace(/\s+/g, ''));
    if (match) {
      await selectPostcode(match);
    } else if (data.results?.[0]) {
      await selectPostcode(data.results[0]);
    }
  };

  const fullAddress = useMemo(() => {
    if (!selectedPostcode) return '';
    const line = houseLine.trim();
    const district = selectedPostcode.adminDistrict ? `, ${selectedPostcode.adminDistrict}` : '';
    return line ? `${line}${district}, ${selectedPostcode.postcode}` : `${selectedPostcode.postcode}${district}`;
  }, [selectedPostcode, houseLine]);

  const handleFileUploadWithRole = (e: React.ChangeEvent<HTMLInputElement>, role: 'existing' | 'proposed' | 'drawing') => {
    if (!e.target.files) return;
    const uploadedFiles = Array.from(e.target.files);
    
    setFiles((prev) => {
      const next = [...prev];
      uploadedFiles.forEach((file) => {
        const index = next.findIndex((f) => f.name === file.name);
        if (index !== -1) {
          next[index] = file;
        } else {
          next.push(file);
        }
      });
      return next;
    });

    setFileRoles((prev) => {
      const next = { ...prev };
      uploadedFiles.forEach((file) => {
        next[file.name] = role;
      });
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPostcode) return;

    setSubmitting(true);
    try {
      const form = new FormData();
      const geo = constraints
        ? {
            lat: constraints.geo.lat,
            lng: constraints.geo.lng,
            postcode: constraints.geo.postcode,
            adminDistrict: constraints.geo.adminDistrict,
            adminWard: constraints.geo.adminWard,
            region: constraints.geo.region,
            parliamentaryConstituency: constraints.geo.parliamentaryConstituency,
          }
        : undefined;

      form.append(
        'metadata',
        JSON.stringify({
          title: title.trim() || `Planning review for ${fullAddress}`,
          address: fullAddress,
          description: description.trim() || 'Householder planning review requested.',
          sourceMode: 'manual',
          sourceNote: 'Address-first submission. Site constraints derived from postcodes.io + planning.data.gov.uk.',
          geo,
          siteConstraints: constraints?.constraints,
          extractedData: advancedOpen ? { neighbourImpactLevel } : undefined,
          filesMetadata: fileRoles,
        })
      );

      files.forEach((file) => form.append('files', file));

      const res = await fetch('/api/applications/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error('Failed to create application');
      const data = await res.json();
      router.push(`/processing/${data.id}`);
    } catch (error) {
      console.error(error);
      alert('Could not start planning audit.');
      setSubmitting(false);
    }
  };

  return (
    <div className={`w-full transition-all duration-500 ${!selectedPostcode ? 'min-h-[60vh] flex flex-col justify-center py-4' : 'py-6 space-y-16'}`}>
      <div className="flex flex-col items-center justify-center text-center max-w-3xl mx-auto space-y-6 w-full">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
          Clear planning reviews for <br />
          <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">UK householder projects</span>
        </h1>

        <p className="text-slate-500 text-sm sm:text-base md:text-lg max-w-lg leading-relaxed">
          Enter a real UK postcode. We look up live conservation area, listed building, flood risk, green belt, and Article 4 records for that exact
          location — no guesswork, no fabricated data.
        </p>

        <div className="w-full max-w-2xl mt-6 text-left transition-all duration-300">
          {selectedPostcode && (
            <div className="flex items-center justify-between mb-10 text-xs font-semibold text-slate-400 border-b border-zinc-100 pb-4">
              <span className={wizardStep >= 1 ? 'text-violet-600 font-bold' : ''}>1. Find site</span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />
              <span className={wizardStep >= 2 ? 'text-violet-600 font-bold' : ''}>2. Proposal details</span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />
              <span className={wizardStep >= 3 ? 'text-violet-600 font-bold' : ''}>3. Add evidence</span>
            </div>
          )}

          {wizardStep === 1 && (
            <div className="space-y-5">
              <div className="relative flex items-center bg-white border border-zinc-200 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-100 rounded-full px-8 py-5 shadow-md hover:shadow-lg transition-all">
                {searchingPostcode ? (
                  <Loader2 className="w-6 h-6 text-violet-500 mr-4 shrink-0 animate-spin" />
                ) : (
                  <Search className="w-6 h-6 text-slate-400 mr-4 shrink-0" />
                )}
                <input
                  type="text"
                  value={postcodeQuery}
                  onChange={(e) => {
                    setPostcodeQuery(e.target.value);
                    setSelectedPostcode(null);
                  }}
                  placeholder="Enter a real UK postcode, e.g. SE22 8QZ"
                  className="w-full bg-transparent text-base sm:text-lg font-medium text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {postcodeSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.postcode}
                    onClick={() => void selectPostcode(suggestion)}
                    className="w-full flex items-start text-left p-3.5 rounded-xl border border-zinc-100 bg-white hover:bg-violet-50/40 hover:border-violet-200 transition-all duration-150 group"
                  >
                    <MapPin className="w-4 h-4 text-slate-400 mr-2.5 mt-0.5 group-hover:text-violet-500 transition-colors" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{suggestion.postcode}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {suggestion.adminDistrict || suggestion.region || 'United Kingdom'} · real postcodes.io record
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-300 ml-auto self-center opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                ))}

                {postcodeQuery.trim().length >= 2 && postcodeSuggestions.length === 0 && !searchingPostcode && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 text-center">
                    No matching UK postcode found yet. Keep typing, or try one of the samples below.
                  </div>
                )}
              </div>

              <div className="pt-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 text-center">Try a real postcode</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {DEMO_POSTCODES.map((demo) => (
                    <button
                      key={demo.postcode}
                      type="button"
                      onClick={() => void loadDemoPostcode(demo.postcode)}
                      className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-violet-300 hover:text-violet-700 transition-colors"
                      title={demo.note}
                    >
                      {demo.postcode}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {wizardStep === 2 && selectedPostcode && (
            <div className="space-y-5">
              <div className="flex items-center space-x-2 text-xs font-semibold text-violet-600 mb-2">
                <MapPin className="w-4 h-4" />
                <span className="truncate">{selectedPostcode.postcode} · {selectedPostcode.adminDistrict || selectedPostcode.region}</span>
              </div>

              {/* Real constraint summary panel */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                  Live constraints from planning.data.gov.uk
                </p>
                {loadingConstraints ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Fetching real government planning records…
                  </div>
                ) : constraints ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <ConstraintPill icon={Landmark} label="Conservation area" active={constraints.constraints.conservationAreas.length > 0} detail={constraints.constraints.conservationAreas[0]?.name} />
                    <ConstraintPill icon={Building2} label="Listed building" active={constraints.constraints.listedBuildings.length > 0} detail={constraints.constraints.listedBuildings[0]?.name} />
                    <ConstraintPill icon={Waves} label={`Flood ${constraints.floodZone}`} active={constraints.floodZone !== 'Zone 1'} detail={constraints.constraints.floodRiskZones[0]?.floodRiskType} />
                    <ConstraintPill icon={TreeDeciduous} label="Green belt" active={constraints.constraints.greenBelt.length > 0} />
                    <ConstraintPill icon={AlertTriangle} label="Article 4 direction" active={constraints.constraints.article4Directions.length > 0} detail={constraints.constraints.article4Directions[0]?.name} />
                    <div className="rounded-lg border border-zinc-200 bg-white px-2.5 py-2 flex items-center text-slate-500 font-medium">
                      {constraints.constraints.totalConstraints} real record(s) found
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Could not load live constraints — you can still continue.</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">House number &amp; street</label>
                <input
                  type="text"
                  value={houseLine}
                  onChange={(e) => setHouseLine(e.target.value)}
                  placeholder="e.g. 24 Kingswood Road"
                  className="w-full bg-zinc-50 border border-zinc-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none transition-all"
                />
                <p className="text-[10px] text-slate-400">Postcodes.io geocodes to postcode level; the street line is combined with it for the application record and map label.</p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Project title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Single-storey rear extension"
                  className="w-full bg-zinc-50 border border-zinc-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Short description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Proposed single storey rear extension extending 4 metres, hip-to-gable loft conversion..."
                  className="w-full bg-zinc-50 border border-zinc-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none transition-all resize-none"
                />
                <p className="text-[10px] text-slate-400">
                  If an LLM key is configured (OpenAI/OpenRouter/local), height, volume, and extension type are read from this text and any uploaded
                  drawing. Otherwise a transparent keyword heuristic is used.
                </p>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => setWizardStep(1)}
                  className="flex items-center justify-center space-x-1 border border-zinc-200 hover:bg-zinc-50 text-slate-600 rounded-xl px-4 py-2.5 text-xs font-bold transition-all"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  onClick={() => setWizardStep(3)}
                  disabled={!houseLine.trim()}
                  className="flex-1 flex items-center justify-center space-x-1 bg-violet-600 hover:bg-violet-500 text-white rounded-xl px-4 py-2.5 text-xs font-bold transition-all shadow-md shadow-violet-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Upload Project Evidence</label>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Slot 1: Existing Plan */}
                  <div className="border border-dashed border-zinc-200 hover:border-violet-300 bg-zinc-50 hover:bg-violet-50/20 rounded-xl p-4 text-center relative transition-all flex flex-col justify-between min-h-[180px] group">
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => handleFileUploadWithRole(e, 'existing')}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="space-y-2 mt-2">
                      <Upload className="w-5 h-5 text-slate-400 mx-auto group-hover:text-violet-500 transition-colors" />
                      <span className="block text-xs font-bold text-slate-700">Existing Plan (Before)</span>
                      <span className="block text-[10px] text-slate-400 leading-normal">
                        Survey floorplan, photo or drawing of the house <strong>before</strong> extension.
                      </span>
                    </div>
                    {/* Status indicator */}
                    <div className="mt-3 shrink-0">
                      {files.filter(f => fileRoles[f.name] === 'existing').length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full">
                          <Check className="w-2.5 h-2.5" /> Added ({files.filter(f => fileRoles[f.name] === 'existing').length})
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-100 border border-slate-200/60 px-2.5 py-0.5 rounded-full">
                          Required for Before view
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Slot 2: Proposed Plan */}
                  <div className="border border-dashed border-zinc-200 hover:border-violet-300 bg-zinc-50 hover:bg-violet-50/20 rounded-xl p-4 text-center relative transition-all flex flex-col justify-between min-h-[180px] group">
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => handleFileUploadWithRole(e, 'proposed')}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="space-y-2 mt-2">
                      <Upload className="w-5 h-5 text-slate-400 mx-auto group-hover:text-violet-500 transition-colors" />
                      <span className="block text-xs font-bold text-slate-700">Proposed Plan (After)</span>
                      <span className="block text-[10px] text-slate-400 leading-normal">
                        Proposed extension floorplan, layout sketch or drawing <strong>after</strong> extension.
                      </span>
                    </div>
                    {/* Status indicator */}
                    <div className="mt-3 shrink-0">
                      {files.filter(f => fileRoles[f.name] === 'proposed').length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full">
                          <Check className="w-2.5 h-2.5" /> Added ({files.filter(f => fileRoles[f.name] === 'proposed').length})
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-100 border border-slate-200/60 px-2.5 py-0.5 rounded-full">
                          Required for After view
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Slot 3: CAD DXF Drawing */}
                  <div className="border border-dashed border-zinc-200 hover:border-violet-300 bg-zinc-50 hover:bg-violet-50/20 rounded-xl p-4 text-center relative transition-all flex flex-col justify-between min-h-[180px] group">
                    <input
                      type="file"
                      accept=".dxf"
                      onChange={(e) => handleFileUploadWithRole(e, 'drawing')}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="space-y-2 mt-2">
                      <Upload className="w-5 h-5 text-slate-400 mx-auto group-hover:text-violet-500 transition-colors" />
                      <span className="block text-xs font-bold text-slate-700">CAD DXF Drawing (Optional)</span>
                      <span className="block text-[10px] text-slate-400 leading-normal">
                        Upload <strong>.dxf</strong> vectors to render high-confidence precise 3D floor plan layout.
                      </span>
                    </div>
                    {/* Status indicator */}
                    <div className="mt-3 shrink-0">
                      {files.filter(f => fileRoles[f.name] === 'drawing').length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full">
                          <Check className="w-2.5 h-2.5" /> Added ({files.filter(f => fileRoles[f.name] === 'drawing').length})
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-100 border border-slate-200/60 px-2.5 py-0.5 rounded-full">
                          Optional
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Uploaded files ({files.length})</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {files.map((file, i) => {
                      const role = fileRoles[file.name] || 'other';
                      const roleBadge = 
                        role === 'existing' 
                          ? 'bg-slate-100 text-slate-700 border-slate-200' 
                          : role === 'proposed'
                          ? 'bg-violet-50 text-violet-700 border-violet-200'
                          : role === 'drawing'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-zinc-100 text-zinc-600 border-zinc-200';
                      
                      const roleLabel = 
                        role === 'existing' 
                          ? 'Before / Existing' 
                          : role === 'proposed'
                          ? 'After / Proposed'
                          : role === 'drawing'
                          ? 'CAD DXF'
                          : 'Other';

                      return (
                        <div key={i} className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-zinc-200/80 shadow-sm text-xs group hover:border-violet-300 transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-4">
                            <span className={`px-2 py-0.5 rounded-md border text-[9px] font-extrabold uppercase tracking-wide shrink-0 ${roleBadge}`}>
                              {roleLabel}
                            </span>
                            <span className="text-slate-700 font-semibold truncate" title={file.name}>
                              {file.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              ({(file.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFiles((prev) => prev.filter((f) => f.name !== file.name));
                              setFileRoles((prev) => {
                                const next = { ...prev };
                                delete next[file.name];
                                return next;
                              });
                            }}
                            className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer p-1 rounded hover:bg-rose-50"
                            title="Remove file"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen(!advancedOpen)}
                  className="flex items-center space-x-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>{advancedOpen ? 'Hide' : 'Add'} neighbour-impact estimate</span>
                </button>

                {advancedOpen && (
                  <div className="mt-3 p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Neighbour amenity impact (no free UK dataset exists for this — please estimate)</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(['low', 'medium', 'high'] as const).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setNeighbourImpactLevel(level)}
                          className={`p-2 rounded-lg border text-xs font-medium text-center capitalize transition-colors ${
                            neighbourImpactLevel === level ? 'border-violet-300 bg-violet-50/50 text-violet-700' : 'border-zinc-200 bg-white text-slate-600'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="flex items-center justify-center space-x-1 border border-zinc-200 hover:bg-zinc-50 text-slate-600 rounded-xl px-4 py-2.5 text-xs font-bold transition-all"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl px-4 py-3 text-xs font-bold transition-all shadow-lg shadow-violet-600/10 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Starting audit...</span>
                    </>
                  ) : (
                    <>
                      <span>Start AI planning audit</span>
                      <Check className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {selectedPostcode && (
        <div className="max-w-4xl mx-auto w-full space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <FileText className="w-4 h-4 text-violet-500" /> Recent applications
            </h2>
            <Link href="/" className="text-xs font-semibold text-violet-600 flex items-center gap-1">
              Refresh <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loadingApps ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : applications.length === 0 ? (
            <p className="text-xs text-slate-400">No submissions yet.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {applications.slice(0, 4).map((app) => (
                <Link
                  key={app.id}
                  href={app.status === 'completed' ? `/review/${app.id}` : `/processing/${app.id}`}
                  className="block p-3 rounded-xl border border-zinc-200/70 bg-white hover:border-violet-300 transition-all text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 truncate max-w-[70%]">{app.title}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase bg-violet-50 text-violet-700">{app.status}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-1">{app.address}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="max-w-3xl mx-auto w-full flex items-center justify-center gap-2 text-[10px] font-semibold text-slate-400 pt-4">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        Real data sources: postcodes.io · planning.data.gov.uk (conservation areas, listed buildings, flood risk zones, green belt, Article 4 directions)
      </div>
    </div>
  );
}

function ConstraintPill({
  icon: Icon,
  label,
  active,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  detail?: string;
}) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 flex items-start gap-1.5 ${
        active ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-zinc-200 bg-white text-slate-500'
      }`}
      title={detail}
    >
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold leading-tight">{label}</p>
        {detail && <p className="truncate text-[10px] opacity-80">{detail}</p>}
      </div>
    </div>
  );
}
