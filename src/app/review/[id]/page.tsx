'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, CheckCircle2, CircleAlert, CircleHelp, FileText, Shield, Sparkles, MapPin, Award } from 'lucide-react';
import { AgentResult, Application, AuditLog, FinalDecision } from '@/lib/types';
import SiteMap3D from '@/app/components/SiteMap3D';
import AccessPanel from '@/app/components/AccessPanel';
import ImpactPanel from '@/app/components/ImpactPanel';

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [results, setResults] = useState<AgentResult[]>([]);
  const [decision, setDecision] = useState<FinalDecision | null>(null);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const res = await fetch(`/api/applications/${id}`);
        const data = await res.json();
        if (!active) return;
        setApplication(data.application);
        setResults(data.results || []);
        setDecision(data.decision || null);
        setAudit(data.logs || []);
        if (data.application?.status !== 'completed' && !data.decision) {
          router.replace(`/processing/${id}`);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [id, router]);

  if (loading || !application || !decision) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <Sparkles className="h-5 w-5 animate-pulse text-violet-600" />
          <span className="text-sm font-semibold text-slate-700">Compiling final decision...</span>
        </div>
      </div>
    );
  }

  const isApprove = decision.recommendation === 'approve';
  const isReview = decision.recommendation === 'review';

  const badge = isApprove
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : isReview
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-rose-50 text-rose-700 border-rose-200';

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          <span>Dashboard</span>
        </Link>
        <span className="text-xs font-semibold text-slate-400">Application Reference: #{application.id.slice(-6)}</span>
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">Real UK data · planning.data.gov.uk</span>
        <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-violet-700">Permission-aware memory · Based AI track</span>
        <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700">Fetch.ai / ASI:One agent bridge</span>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">Weeks → minutes · Conduct AI track</span>
      </div>

      {/* Hero Recommendation Summary */}
      <section className="glass-panel p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3 flex-1">
            <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${badge}`}>
              <Award className="w-3.5 h-3.5" />
              {decision.recommendation} recommended
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{application.title}</h1>
            <p className="text-sm leading-relaxed text-slate-600 font-medium">{decision.summary}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-5 min-w-[160px] text-center shadow-inner">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Compliance Score</p>
            <p className="mt-2 text-4xl font-extrabold text-slate-900">{decision.overallScore}<span className="text-xs text-slate-400">/100</span></p>
            <p className="mt-1 text-[10px] font-semibold text-slate-400">Confidence {decision.overallConfidence}%</p>
          </div>
        </div>
      </section>

      {/* Real-data 3D site map */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Site in 3D — real map, real constraints</h2>
          <span className="text-[10px] font-semibold text-slate-400">postcodes.io + planning.data.gov.uk + MapLibre/OpenFreeMap</span>
        </div>
        <SiteMap3D application={application} recommendation={decision.recommendation} />
      </section>

      <ImpactPanel agentCount={results.length} />

      {/* Highlights & Facts Grid */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="bg-white border border-zinc-200/60 p-5 rounded-2xl shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Submission Details</p>
          <div className="mt-4 space-y-3.5 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-violet-600" />
              <span className="truncate">{application.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-violet-600" />
              <span>{new Date(application.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-violet-600" />
              <span>{application.files.length} document(s) evaluated</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-violet-600" />
              <span className="truncate">{application.sourceNote || 'Direct entry'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-zinc-200/60 p-5 rounded-2xl shadow-sm lg:col-span-2 space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Triage Insights & Key Findings</p>
          <div className="space-y-4 text-xs">
            {decision.risks.length > 0 && (
              <div>
                <p className="font-bold text-slate-800">Critical Risks Identified</p>
                <ul className="mt-2 space-y-1.5">
                  {decision.risks.map((risk) => (
                    <li key={risk} className="flex gap-2 text-slate-600">
                      <CircleAlert className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                      <span className="font-medium">{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {decision.suggestedChanges.length > 0 && (
              <div>
                <p className="font-bold text-slate-800">Remedial Recommendations</p>
                <ul className="mt-2 space-y-1.5">
                  {decision.suggestedChanges.map((item) => (
                    <li key={item} className="flex gap-2 text-slate-600">
                      <CircleHelp className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                      <span className="font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {decision.risks.length === 0 && decision.suggestedChanges.length === 0 && (
              <p className="text-slate-500 font-medium">No special risks or modifications required. This proposal shows exceptional alignment with guidelines.</p>
            )}
          </div>
        </div>
      </section>

      {/* Agent Detail Breakdowns */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Agent Checklists & Policy Citations</h2>
          <div className="space-y-3">
            {results.map((result) => (
              <details key={result.agentType} className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-all">
                <summary className="cursor-pointer list-none outline-none">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold capitalize text-slate-900">{result.agentType} Agent</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Score {result.score}/100 · Confidence {result.confidence}% · {result.decision}
                      </p>
                    </div>
                    {result.decision === 'approve' ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    ) : result.decision === 'review' ? (
                      <CircleHelp className="h-5 w-5 text-amber-500 shrink-0" />
                    ) : (
                      <CircleAlert className="h-5 w-5 text-rose-500 shrink-0" />
                    )}
                  </div>
                </summary>
                <div className="mt-4 space-y-4 border-t border-zinc-100 pt-4 text-xs text-slate-600">
                  <div>
                    <p className="font-bold text-slate-800">Reasoning</p>
                    <p className="mt-1 leading-relaxed font-medium">{result.reasoning}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Derived Evidence</p>
                    <ul className="mt-1.5 space-y-1">
                      {result.evidence.map((item) => (
                        <li key={item} className="flex items-center gap-1.5 font-medium text-slate-500">
                          <span className="w-1 h-1 rounded-full bg-violet-500 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {result.policyRefs.length > 0 && (
                    <div>
                      <p className="font-bold text-slate-800">Guidance Citations</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {result.policyRefs.map((item) => (
                          <span key={item} className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* Audit Pipeline Trail */}
        <div className="space-y-4">
          <AccessPanel applicationId={application.id} />

          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Verifiable Audit Trail</h2>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {audit.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm text-xs">
                <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-1.5 mb-1.5">
                  <p className="font-bold uppercase text-violet-700">{entry.step}</p>
                  <p className="text-[10px] text-slate-400">{new Date(entry.timestamp).toLocaleTimeString('en-GB')}</p>
                </div>
                <p className="text-slate-600 leading-relaxed font-medium">{entry.message}</p>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center">
                  <Shield className="w-3 h-3 mr-1" />
                  Actor: {entry.actor}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
