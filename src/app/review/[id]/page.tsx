'use client';

import { useEffect, useState, use, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Calendar, 
  CheckCircle2, 
  CircleAlert, 
  CircleHelp, 
  FileText, 
  Shield, 
  Sparkles, 
  MapPin, 
  Award, 
  ChevronRight, 
  SlidersHorizontal, 
  Move, 
  Ruler, 
  Save, 
  RefreshCw
} from 'lucide-react';
import { AgentResult, Application, AuditLog, FinalDecision, FileRecord } from '@/lib/types';
import SiteMap3D from '@/app/components/SiteMap3D';
import AccessPanel from '@/app/components/AccessPanel';
import ImpactPanel from '@/app/components/ImpactPanel';
import StructuralPlan3D from '@/app/components/StructuralPlan3D';

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [results, setResults] = useState<AgentResult[]>([]);
  const [decision, setDecision] = useState<FinalDecision | null>(null);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Expanded states for individual AI Agents collapsible cards
  const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>({
    'policy': true, // Keep first agent expanded by default for discoverability
  });

  // 3D Massing Editor State (Overriding values for real-time live-preview on the map)
  const [overrideHeight, setOverrideHeight] = useState<number>(3);
  const [overrideWidth, setOverrideWidth] = useState<number>(10);
  const [overrideDepth, setOverrideDepth] = useState<number>(10);
  const [overrideRotationDeg, setOverrideRotationDeg] = useState<number>(0);
  const [overrideLatOffsetM, setOverrideLatOffsetM] = useState<number>(0);
  const [overrideLngOffsetM, setOverrideLngOffsetM] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isMassingModalOpen, setIsMassingModalOpen] = useState(false);
  const [showSketchReference, setShowSketchReference] = useState(true);
  const [activeImageRole, setActiveImageRole] = useState<'existing' | 'proposed'>('proposed');

  const fetchApplicationDetails = async () => {
    // Defer setLoading(true) to a microtask to avoid synchronous setState inside useEffect
    await Promise.resolve();
    setLoading(true);
    try {
      const res = await fetch(`/api/applications/${id}`);
      const data = await res.json();
      
      setApplication(data.application);
      setResults(data.results || []);
      setDecision(data.decision || null);
      setAudit(data.logs || []);

      if (data.application) {
        const app = data.application;
        setOverrideHeight(app.extractedData?.proposedHeight ?? 3);
        setOverrideWidth(app.extractedData?.footprint?.widthM ?? 10);
        setOverrideDepth(app.extractedData?.footprint?.depthM ?? 10);
        setOverrideRotationDeg(app.extractedData?.footprint?.rotationDeg ?? 0);
        setOverrideLatOffsetM(app.extractedData?.footprint?.latOffsetM ?? 0);
        setOverrideLngOffsetM(app.extractedData?.footprint?.lngOffsetM ?? 0);

        const hasProposed = app.files.some((f: FileRecord) => f.role === 'proposed' && /\.(png|jpg|jpeg|webp)$/i.test(f.name));
        const hasExisting = app.files.some((f: FileRecord) => f.role === 'existing' && /\.(png|jpg|jpeg|webp)$/i.test(f.name));
        if (hasProposed) {
          setActiveImageRole('proposed');
        } else if (hasExisting) {
          setActiveImageRole('existing');
        }
      }

      if (data.application?.status !== 'completed' && !data.decision) {
        router.replace(`/processing/${id}`);
      }
    } catch (err) {
      console.error('Error loading application:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial application data fetch and slider sync
    void fetchApplicationDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  const hasImages = useMemo(() => {
    if (!application) return false;
    return application.files.some(f => /\.(png|jpg|jpeg|webp)$/i.test(f.name));
  }, [application]);

  const hasExistingRoleFile = useMemo(() => {
    if (!application) return false;
    return application.files.some(f => f.role === 'existing' && /\.(png|jpg|jpeg|webp)$/i.test(f.name));
  }, [application]);

  const hasProposedRoleFile = useMemo(() => {
    if (!application) return false;
    return application.files.some(f => f.role === 'proposed' && /\.(png|jpg|jpeg|webp)$/i.test(f.name));
  }, [application]);

  const imageFile = useMemo(() => {
    if (!application) return null;
    const existing = application.files.find(f => f.role === 'existing' && /\.(png|jpg|jpeg|webp)$/i.test(f.name));
    const proposed = application.files.find(f => f.role === 'proposed' && /\.(png|jpg|jpeg|webp)$/i.test(f.name));
    if (activeImageRole === 'existing') return existing || null;
    if (activeImageRole === 'proposed') return proposed || null;
    return proposed || existing || application.files.find(f => /\.(png|jpg|jpeg|webp)$/i.test(f.name)) || null;
  }, [application, activeImageRole]);

  if (loading || !application || !decision) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-zinc-200/50 bg-white/70 backdrop-blur-md px-8 py-8 shadow-xl">
          <Sparkles className="h-8 w-8 animate-spin text-violet-600" />
          <div className="text-center">
            <span className="text-base font-bold text-slate-800 block">Compiling final decision...</span>
            <span className="text-xs text-slate-400 mt-1 block font-medium">Synthesizing multiple AI agent reports and constraints</span>
          </div>
        </div>
      </div>
    );
  }

  const isApprove = decision.recommendation === 'approve';
  const isReview = decision.recommendation === 'review';

  const badgeColor = isApprove
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60 shadow-emerald-100/10'
    : isReview
    ? 'bg-amber-50 text-amber-700 border-amber-200/60 shadow-amber-100/10'
    : 'bg-rose-50 text-rose-700 border-rose-200/60 shadow-rose-100/10';

  const glowBorder = isApprove
    ? 'hover:border-emerald-300 focus-within:border-emerald-400'
    : isReview
    ? 'hover:border-amber-300 focus-within:border-amber-400'
    : 'hover:border-rose-300 focus-within:border-rose-400';

  const toggleAgent = (agentType: string) => {
    setExpandedAgents((prev) => ({
      ...prev,
      [agentType]: !prev[agentType],
    }));
  };

  const handleSaveGeometry = async () => {
    setIsSaving(true);
    setSaveSuccess(null);
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extractedData: {
            proposedHeight: overrideHeight,
            footprint: {
              source: 'custom',
              widthM: overrideWidth,
              depthM: overrideDepth,
              areaM2: Number((overrideWidth * overrideDepth).toFixed(1)),
              vertexCount: application.extractedData?.footprint?.vertexCount ?? 4,
              unitAssumption: 'Manually adjusted in 3D Editor',
              rotationDeg: overrideRotationDeg,
              latOffsetM: overrideLatOffsetM,
              lngOffsetM: overrideLngOffsetM,
              centroidM: application.extractedData?.footprint?.centroidM,
              verticesM: application.extractedData?.footprint?.verticesM,
              parserConfidence: application.extractedData?.footprint?.parserConfidence,
              entityTypeCounts: application.extractedData?.footprint?.entityTypeCounts,
              layerSummaries: application.extractedData?.footprint?.layerSummaries,
              structuralLayers: application.extractedData?.footprint?.structuralLayers,
            },
          },
        }),
      });

      if (!res.ok) throw new Error('Failed to save 3D adjustments');
      const data = await res.json();
      
      // Update states
      setApplication(data.application);
      
      // Reload details to sync logs instantly
      const updatedRes = await fetch(`/api/applications/${id}`);
      const updatedData = await updatedRes.json();
      if (updatedData.logs) {
        setAudit(updatedData.logs);
      }

      setSaveSuccess('3D model adjustments saved successfully!');
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err) {
      console.error(err);
      alert('Could not save adjustments.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDxf = () => {
    const defaultDxf = application.extractedData?.footprint?.source === 'dxf' ? application.extractedData.footprint : null;
    
    setOverrideHeight(application.extractedData?.proposedHeight ?? 3);
    setOverrideWidth(defaultDxf?.widthM ?? 10);
    setOverrideDepth(defaultDxf?.depthM ?? 10);
    setOverrideRotationDeg(defaultDxf?.rotationDeg ?? 0);
    setOverrideLatOffsetM(0);
    setOverrideLngOffsetM(0);
  };

  // Radial score progress variables
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const scoreOffset = circumference - (decision.overallScore / 100) * circumference;

  return (
    <div className="space-y-10 max-w-6xl mx-auto py-6 px-4">
      {/* Top Breadcrumb & Status Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/50 pb-5">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-wider">
          <ArrowLeft className="h-4 w-4 text-violet-600" />
          <span>Dashboard</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-400 tracking-wide uppercase">
            Application: #{application.id.slice(-6)}
          </span>
        </div>
      </div>

      {/* Decorative Branding Badges */}
      <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
        <span className="rounded-full border border-emerald-200 bg-emerald-50/50 px-3 py-1 text-emerald-700 shadow-sm">
          Real UK data · planning.data.gov.uk
        </span>
        <span className="rounded-full border border-violet-200 bg-violet-50/50 px-3 py-1 text-violet-700 shadow-sm">
          Permission-aware memory · Based AI track
        </span>
        <span className="rounded-full border border-sky-200 bg-sky-50/50 px-3 py-1 text-sky-700 shadow-sm">
          Fetch.ai / ASI:One agent bridge
        </span>
        <span className="rounded-full border border-amber-200 bg-amber-50/50 px-3 py-1 text-amber-700 shadow-sm">
          Weeks → minutes · Conduct AI track
        </span>
      </div>

      {/* Hero Grid Dashboard (3-Column Layout) */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        
        {/* Card 1: AI Verdict and Summary */}
        <section className={`glass-panel p-6 flex flex-col justify-between border-t-4 transition-all duration-300 shadow-md ${glowBorder} ${
          isApprove ? 'border-t-emerald-500' : isReview ? 'border-t-amber-500' : 'border-t-rose-500'
        }`}>
          <div className="space-y-4">
            <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold uppercase tracking-wider ${badgeColor}`}>
              <Award className="w-3.5 h-3.5" />
              {decision.recommendation} recommended
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-snug">
              {application.title}
            </h1>
            <p className="text-xs leading-relaxed text-slate-500 font-medium">
              {decision.summary}
            </p>
          </div>
          <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>AI Audit Verdict</span>
            <span className="text-violet-600">Verified</span>
          </div>
        </section>

        {/* Card 2: Interactive SVG Compliance Score Meter */}
        <section className="glass-panel p-6 flex flex-col justify-between items-center shadow-md text-center hover:border-violet-300 transition-colors duration-300">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">Compliance Score</p>
          
          <div className="relative flex items-center justify-center h-28 w-28 my-2">
            <svg className="w-full h-full transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="56"
                cy="56"
                r={radius}
                stroke="#e2e8f0"
                strokeWidth="8"
                fill="transparent"
                opacity="0.5"
              />
              {/* Progress circle */}
              <circle
                cx="56"
                cy="56"
                r={radius}
                stroke="url(#radial-gradient)"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={scoreOffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="radial-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-slate-900 tracking-tight">{decision.overallScore}</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mt-0.5">/100</span>
            </div>
          </div>

          <div className="space-y-1 mt-2">
            <p className="text-[11px] font-bold text-slate-600">Overall confidence metric: <span className="text-violet-600 font-extrabold">{decision.overallConfidence}%</span></p>
            <p className="text-[10px] text-slate-400 font-medium">Evaluated across five legal constraint layers</p>
          </div>
        </section>

        {/* Card 3: Submission Details and Document list */}
        <section className="glass-panel p-6 flex flex-col justify-between shadow-md hover:border-violet-300 transition-colors duration-300">
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Submission Details</p>
            <div className="space-y-3 text-xs font-bold text-slate-600">
              <div className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-violet-600 shrink-0" />
                <span className="truncate" title={application.address}>{application.address}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Calendar className="h-4 w-4 text-violet-600 shrink-0" />
                <span>{new Date(application.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-violet-600 shrink-0" />
                <span>{application.files.length} document(s) evaluated</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Shield className="h-4 w-4 text-violet-600 shrink-0" />
                <span className="truncate text-slate-500 font-semibold">{application.sourceNote || 'Manual Entry'}</span>
              </div>
            </div>
          </div>
          
          <div className="border-t border-slate-100 pt-3 mt-4 flex flex-wrap gap-1 items-center max-h-16 overflow-y-auto">
            {application.files.map((file, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 rounded bg-slate-50 border border-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-500 max-w-[150px] truncate" title={file.name}>
                <FileText className="w-2.5 h-2.5 shrink-0" /> {file.name}
              </span>
            ))}
          </div>
        </section>

      </div>

      {/* Interactive Proposal and Map Container */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              Interactive Proposal &amp; Site Map
            </h2>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">Drag sliders to adjust height, sizing, and position offsets on the live map</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-black text-slate-400 bg-slate-100 rounded border border-slate-200 px-2.5 py-2 uppercase tracking-widest">
              60FPS LIVE PREVIEW
            </span>
            {hasImages && !showSketchReference && (
              <button 
                onClick={() => setShowSketchReference(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 text-[10px] font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5 text-violet-600 animate-pulse" /> Show Sketch Plan
              </button>
            )}
            <button 
              onClick={() => setIsMassingModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 text-[10px] font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Adjust Sizing &amp; Location
            </button>
          </div>
        </div>

        {/* Map & Drawing Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Map View Container */}
          <div className={`${showSketchReference && hasImages ? 'lg:col-span-2' : 'lg:col-span-3'} relative transition-all duration-500`}>
            <SiteMap3D 
              application={application} 
              recommendation={decision.recommendation}
              overrideHeight={overrideHeight}
              overrideWidth={overrideWidth}
              overrideDepth={overrideDepth}
              overrideRotationDeg={overrideRotationDeg}
              overrideLatOffsetM={overrideLatOffsetM}
              overrideLngOffsetM={overrideLngOffsetM}
            />
          </div>

          {/* Uploaded Drawing Reference Panel */}
          {showSketchReference && hasImages && (
            <div className="lg:col-span-1 glass-panel p-5 bg-gradient-to-b from-white/90 to-slate-50/50 flex flex-col justify-between border border-zinc-200/60 shadow-md h-[480px] lg:h-auto min-h-[480px] animate-fade-in transition-all duration-500">
              <div className="space-y-4 flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200/50 pb-3 shrink-0">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-violet-600" /> Uploaded Drawings
                  </span>
                  <button 
                    onClick={() => setShowSketchReference(false)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    title="Hide Sketch panel"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Sliding Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/40 shrink-0">
                  <button
                    onClick={() => setActiveImageRole('existing')}
                    className={`flex-1 text-center py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeImageRole === 'existing'
                        ? 'bg-white text-slate-800 shadow-sm border border-slate-200/20'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${hasExistingRoleFile ? 'bg-slate-500' : 'bg-slate-300'}`} />
                    Before (Existing)
                  </button>
                  <button
                    onClick={() => setActiveImageRole('proposed')}
                    className={`flex-1 text-center py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeImageRole === 'proposed'
                        ? 'bg-white text-slate-800 shadow-sm border border-slate-200/20'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${hasProposedRoleFile ? 'bg-violet-500 animate-pulse' : 'bg-slate-300'}`} />
                    After (Proposed)
                  </button>
                </div>

                {/* Image Body */}
                <div className="relative flex-1 rounded-xl border border-slate-200/80 bg-zinc-900/5 overflow-hidden flex items-center justify-center p-2 group">
                  {imageFile ? (
                    <>
                      <img 
                        src={imageFile.url} 
                        alt={imageFile.name}
                        className="max-h-full max-w-full object-contain rounded-lg shadow-sm group-hover:scale-105 transition-transform duration-500"
                      />
                      {/* Glass tag */}
                      <div className="absolute bottom-2.5 left-2.5 rounded-full bg-slate-900/70 backdrop-blur-md px-3 py-1 text-[9px] font-bold text-white uppercase tracking-wider max-w-[90%] truncate">
                        {imageFile.name}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
                      <div className="p-3 bg-slate-100 rounded-full text-slate-400">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-700 block">No {activeImageRole} drawing</span>
                        <span className="text-[10px] text-slate-400 block mt-1 leading-relaxed max-w-[180px] mx-auto">
                          You did not upload an image designated as the {activeImageRole === 'existing' ? 'Before (Existing)' : 'After (Proposed)'} plan.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Info Footer */}
                <div className="bg-slate-100/70 rounded-xl border border-slate-200/50 p-3 text-[10px] space-y-1 text-slate-500 shrink-0">
                  <p className="font-bold">This drawing is processed by our extraction agent to align with the 3D block model shown on the map.</p>
                  <p className="text-[9px] text-slate-400 mt-0.5 font-medium">Use the &quot;Adjust Massing&quot; modal to manually refine coordinates and sizing.</p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Adjust Massing Modal */}
        {isMassingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
            <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-violet-600" /> Adjust Massing &amp; Location
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleResetToDxf}
                    className="inline-flex items-center gap-1 text-[9px] font-extrabold text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded px-2 py-1 uppercase tracking-wider transition-all"
                    title="Reset to original parsed files data"
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> Reset
                  </button>
                  <button 
                    onClick={() => setIsMassingModalOpen(false)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Slider Controls */}
              <div className="space-y-4">
                
                {/* Height Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span className="flex items-center gap-1"><Ruler className="w-3 h-3 text-violet-600" /> Height</span>
                    <span className="text-slate-700 font-extrabold text-xs">{overrideHeight.toFixed(1)}m</span>
                  </div>
                  <input 
                    type="range" 
                    min={1.0} 
                    max={12.0} 
                    step={0.1}
                    value={overrideHeight} 
                    onChange={(e) => setOverrideHeight(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                  />
                  <div className="flex justify-between text-[8px] text-slate-400 font-bold">
                    <span>1.0m</span>
                    <span>12.0m (Multi-Floor Extension)</span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    step={0.1}
                    value={overrideHeight}
                    onChange={(e) => setOverrideHeight(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-violet-400"
                  />
                </div>

                {/* Width Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Width</span>
                    <span className="text-slate-700 font-extrabold text-xs">{overrideWidth.toFixed(1)}m</span>
                  </div>
                  <input 
                    type="range" 
                    min={1.0} 
                    max={40.0} 
                    step={0.5}
                    value={overrideWidth} 
                    onChange={(e) => setOverrideWidth(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                  />
                  <input
                    type="number"
                    min={1}
                    max={80}
                    step={0.1}
                    value={overrideWidth}
                    onChange={(e) => setOverrideWidth(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-violet-400"
                  />
                </div>

                {/* Depth Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Depth</span>
                    <span className="text-slate-700 font-extrabold text-xs">{overrideDepth.toFixed(1)}m</span>
                  </div>
                  <input 
                    type="range" 
                    min={1.0} 
                    max={40.0} 
                    step={0.5}
                    value={overrideDepth} 
                    onChange={(e) => setOverrideDepth(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                  />
                  <input
                    type="number"
                    min={1}
                    max={80}
                    step={0.1}
                    value={overrideDepth}
                    onChange={(e) => setOverrideDepth(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-violet-400"
                  />
                </div>

                {/* Rotation Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Rotation</span>
                    <span className="text-slate-700 font-extrabold text-xs">{overrideRotationDeg.toFixed(0)}°</span>
                  </div>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={overrideRotationDeg}
                    onChange={(e) => setOverrideRotationDeg(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                  />
                  <input
                    type="number"
                    min={-180}
                    max={180}
                    step={1}
                    value={overrideRotationDeg}
                    onChange={(e) => setOverrideRotationDeg(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-violet-400"
                  />
                </div>

                {/* Position Adjuster Heading */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                    <Move className="w-3.5 h-3.5 text-violet-600" /> Position Adjustments
                  </span>
                </div>

                {/* East-West Shift */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span>East-West Shift</span>
                    <span className="text-slate-700 font-extrabold text-xs">
                      {overrideLngOffsetM > 0 ? `+${overrideLngOffsetM.toFixed(1)}m East` : overrideLngOffsetM < 0 ? `${Math.abs(overrideLngOffsetM).toFixed(1)}m West` : '0.0m'}
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min={-30} 
                    max={30} 
                    step={0.5}
                    value={overrideLngOffsetM} 
                    onChange={(e) => setOverrideLngOffsetM(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                  />
                  <input
                    type="number"
                    min={-100}
                    max={100}
                    step={0.1}
                    value={overrideLngOffsetM}
                    onChange={(e) => setOverrideLngOffsetM(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-violet-400"
                  />
                </div>

                {/* North-South Shift */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span>North-South Shift</span>
                    <span className="text-slate-700 font-extrabold text-xs">
                      {overrideLatOffsetM > 0 ? `+${overrideLatOffsetM.toFixed(1)}m North` : overrideLatOffsetM < 0 ? `${Math.abs(overrideLatOffsetM).toFixed(1)}m South` : '0.0m'}
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min={-30} 
                    max={30} 
                    step={0.5}
                    value={overrideLatOffsetM} 
                    onChange={(e) => setOverrideLatOffsetM(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                  />
                  <input
                    type="number"
                    min={-100}
                    max={100}
                    step={0.1}
                    value={overrideLatOffsetM}
                    onChange={(e) => setOverrideLatOffsetM(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-violet-400"
                  />
                </div>

              </div>

              {/* Live Footprint Metrics Feedback */}
              <div className="bg-slate-100/70 rounded-xl border border-slate-200/50 p-3 text-[10px] space-y-1.5">
                <div className="flex justify-between text-slate-500 font-bold">
                  <span>Footprint Area:</span>
                  <span className="text-slate-700 font-extrabold">{(overrideWidth * overrideDepth).toFixed(1)} m²</span>
                </div>
                <div className="flex justify-between text-slate-500 font-bold">
                  <span>Unit Assumption:</span>
                  <span className="text-slate-700 font-extrabold truncate max-w-[150px]" title={application.extractedData?.footprint?.unitAssumption || 'assumed centimeters'}>
                    {application.extractedData?.footprint?.unitAssumption || 'Centimeters (Mid-Range Coordinates)'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500 font-bold">
                  <span>Sizing Source:</span>
                  <span className="text-violet-600 font-black uppercase">
                    {application.extractedData?.footprint?.source === 'custom' ? 'User Manual override' : 'Extracted from DXF'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500 font-bold">
                  <span>DXF Layers:</span>
                  <span className="text-slate-700 font-extrabold">{application.extractedData?.footprint?.layerSummaries?.length || 0}</span>
                </div>
              </div>

              {/* Save Button & Actions */}
              <div className="pt-4 border-t border-slate-200/50 mt-2 space-y-3">
                {saveSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-[10px] font-bold text-emerald-800 flex items-start gap-1.5 animate-pulse">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{saveSuccess}</span>
                  </div>
                )}
                
                <button
                  onClick={handleSaveGeometry}
                  disabled={isSaving}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl py-3 text-xs font-bold transition-all shadow-lg shadow-violet-600/10 hover:shadow-violet-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Geometry...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Sizing &amp; Location</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        )}
      </section>

      <StructuralPlan3D
        application={application}
        overrideHeight={overrideHeight}
        overrideWidth={overrideWidth}
        overrideDepth={overrideDepth}
        overrideRotationDeg={overrideRotationDeg}
      />

      {/* Key Triage Insights & Risks Grid */}
      <section className="grid gap-6 lg:grid-cols-2">
        
        {/* Risks card */}
        <div className="bg-white border border-zinc-200/60 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Critical Risks Identified</p>
          <div className="space-y-4">
            {decision.risks.length > 0 ? (
              <ul className="space-y-3 text-xs">
                {decision.risks.map((risk, index) => (
                  <li key={index} className="flex gap-2.5 text-slate-600 border border-rose-100 bg-rose-50/20 rounded-xl p-3">
                    <CircleAlert className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-800">Observation {index + 1}</span>
                      <p className="mt-1 leading-relaxed text-slate-600 font-medium">{risk}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex gap-2.5 text-slate-500 border border-emerald-100 bg-emerald-50/20 rounded-xl p-4 text-xs font-bold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>No major risks identified. Proposal complies excellently.</span>
              </div>
            )}
          </div>
        </div>

        {/* Suggested changes/modifications card */}
        <div className="bg-white border border-zinc-200/60 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Remedial Recommendations</p>
          <div className="space-y-4">
            {decision.suggestedChanges.length > 0 ? (
              <ul className="space-y-3 text-xs">
                {decision.suggestedChanges.map((change, index) => (
                  <li key={index} className="flex gap-2.5 text-slate-600 border border-violet-100 bg-violet-50/10 rounded-xl p-3">
                    <CircleHelp className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-800">Actionable Suggestion {index + 1}</span>
                      <p className="mt-1 leading-relaxed text-slate-600 font-medium">{change}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex gap-2.5 text-slate-500 border border-emerald-100 bg-emerald-50/20 rounded-xl p-4 text-xs font-bold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>No modifications or remediations required.</span>
              </div>
            )}
          </div>
        </div>

      </section>

      {/* Collapsible Agent Reports and Auditing timelines side-by-side */}
      <section className="grid gap-6 lg:grid-cols-2">
        
        {/* Left column: Expanded custom AI Agent breakdown cards */}
        <div className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">Agent Checklists &amp; Policy Citations</h2>
          
          <div className="space-y-3">
            {results.map((result) => {
              const isExpanded = !!expandedAgents[result.agentType];
              const isAgentApprove = result.decision === 'approve';
              const isAgentReview = result.decision === 'review';
              
              const agentBadge = isAgentApprove
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60 shadow-sm'
                : isAgentReview
                ? 'bg-amber-50 text-amber-700 border-amber-200/60 shadow-sm'
                : 'bg-rose-50 text-rose-700 border-rose-200/60 shadow-sm';

              return (
                <div 
                  key={result.agentType} 
                  className="rounded-2xl border border-zinc-200 bg-white shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
                >
                  <button 
                    onClick={() => toggleAgent(result.agentType)}
                    className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors border-none outline-none focus:bg-slate-50/30"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold capitalize text-slate-900">{result.agentType} AI Agent</p>
                        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${agentBadge}`}>
                          {result.decision}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 font-bold">
                        Score <span className="text-slate-600 font-extrabold">{result.score}/100</span> · Confidence <span className="text-slate-600 font-extrabold">{result.confidence}%</span>
                        {' '}· Evidence <span className="text-slate-600 font-extrabold">{result.evidenceQuality || 'heuristic'}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAgentApprove ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : isAgentReview ? (
                        <CircleHelp className="h-5 w-5 text-amber-500" />
                      ) : (
                        <CircleAlert className="h-5 w-5 text-rose-500" />
                      )}
                      <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform duration-300 shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </button>
                  
                  {/* Expanded Content Section with smooth transitions */}
                  {isExpanded && (
                    <div className="p-4 border-t border-zinc-100 bg-slate-50/40 text-xs space-y-4">
                      
                      {/* Reasoning paragraph */}
                      <div className="space-y-1">
                        <p className="font-extrabold text-slate-800 uppercase tracking-widest text-[9px]">Reasoning &amp; Assessment</p>
                        <p className="leading-relaxed text-slate-600 font-medium">{result.reasoning}</p>
                      </div>

                      {/* Evidence checklist */}
                      <div className="space-y-1.5">
                        <p className="font-extrabold text-slate-800 uppercase tracking-widest text-[9px]">Derived Evidence &amp; Parameters</p>
                        <ul className="space-y-1.5">
                          {result.evidence.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2 font-semibold text-slate-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0 mt-1.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Policy Citations */}
                      {result.policyRefs.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-zinc-100">
                          <p className="font-extrabold text-slate-800 uppercase tracking-widest text-[9px]">Official Policy Citations</p>
                          <div className="flex flex-wrap gap-1.5">
                            {result.policyRefs.map((citation, idx) => (
                              <span key={idx} className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-[10px] font-bold text-slate-500 shadow-sm hover:border-violet-300 transition-colors">
                                {citation}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: Verifiable Audit Trail */}
        <div className="space-y-4">

          {/* Verifiable audit trail log pipeline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">Verifiable Audit Trail</h2>
              <span className="text-[9px] font-black text-slate-400 tracking-wider">SECURE LEDGER</span>
            </div>
            
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1 border border-zinc-200/50 bg-white rounded-2xl p-4 shadow-sm">
              {audit.map((entry) => (
                <div key={entry.id} className="relative pl-5 border-l-2 border-slate-100 pb-4 last:pb-0 text-xs">
                  {/* Ledger node dot */}
                  <div className="absolute -left-[6px] top-1 h-2.5 w-2.5 rounded-full border bg-white border-violet-500" />
                  
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5 mb-1.5">
                    <p className="font-black uppercase tracking-widest text-[9px] text-violet-700">{entry.step}</p>
                    <p className="text-[10px] text-slate-400 font-bold">
                      {new Date(entry.timestamp).toLocaleTimeString('en-GB')}
                    </p>
                  </div>
                  
                  <p className="text-slate-600 leading-relaxed font-semibold">{entry.message}</p>
                  
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-violet-500 shrink-0" />
                    Actor: {entry.actor}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </section>

      {/* Traditional vs Tool turnaround benchmarker */}
      <ImpactPanel agentCount={results.length} />

      {/* Permission-aware temporal rules control panel */}
      <AccessPanel applicationId={application.id} />

    </div>
  );
}
