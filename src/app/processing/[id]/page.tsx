'use client';

import { useEffect, useMemo, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CircleCheckBig, CircleAlert, Clock3, RefreshCcw, MapPin, Sparkles } from 'lucide-react';
import { AgentResult, Application, AuditLog, AgentType } from '@/lib/types';

type AgentState = 'pending' | 'running' | 'completed' | 'failed';

const agentOrder: AgentType[] = ['policy', 'heritage', 'flood', 'highways', 'neighbour'];

export default function ProcessingPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [application, setApplication] = useState<Application | null>(null);
  const [results, setResults] = useState<AgentResult[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const agentStates = useMemo<Record<AgentType, AgentState>>(() => {
    const states: Record<AgentType, AgentState> = {
      policy: 'pending',
      heritage: 'pending',
      flood: 'pending',
      highways: 'pending',
      neighbour: 'pending',
    };

    audit.forEach((entry) => {
      if (entry.step === 'agent-started') {
        const key = entry.details?.agentType as AgentType | undefined;
        if (key) states[key] = 'running';
      }
      if (entry.step === 'agent-completed') {
        const key = entry.details?.agentType as AgentType | undefined;
        if (key) states[key] = 'completed';
      }
      if (entry.step === 'agent-failed') {
        const key = entry.details?.agentType as AgentType | undefined;
        if (key) states[key] = 'failed';
      }
    });

    results.forEach((result) => {
      states[result.agentType] = 'completed';
    });

    return states;
  }, [audit, results]);

  useEffect(() => {
    let active = true;
    const fetchState = async () => {
      const res = await fetch(`/api/applications/${id}`);
      if (!res.ok) throw new Error('Failed to load application');
      const data = await res.json();
      setApplication(data.application);
      setResults(data.results || []);
      setAudit(data.logs || []);
      return data.application as Application;
    };

    void (async () => {
      try {
        const app = await fetchState();
        if (active && app.status === 'pending') {
          setRunning(true);
          void fetch(`/api/applications/${id}/run-agents`, { method: 'POST' });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    const interval = setInterval(() => {
      void (async () => {
        try {
          const app = await fetchState();
          if (app.status === 'completed' || app.status === 'failed') {
            router.replace(`/review/${id}`);
          }
        } catch (error) {
          console.error(error);
        }
      })();
    }, 1500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [id, router]);

  if (loading || !application) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
          <span className="text-sm font-semibold text-slate-700">Starting planning analysis...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      {/* Processing Status Banner */}
      <section className="glass-panel p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center space-x-2 text-xs uppercase tracking-widest font-bold text-violet-600">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Live Audit Pipeline</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">{application.title}</h1>
            <p className="mt-1 text-sm text-slate-500 flex items-center">
              <MapPin className="w-3.5 h-3.5 mr-1" />
              {application.address}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
            <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
            {running ? 'Agents processing...' : 'Loaded'}
          </div>
        </div>
      </section>

      {/* Agents & Audit Flow */}
      <section className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">Specialist agents status</h2>
          {agentOrder.map((agentType) => {
            const result = results.find((item) => item.agentType === agentType);
            const state = agentStates[agentType];
            return (
              <div key={agentType} className="bg-white border border-zinc-200/60 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div>
                  <p className="text-sm font-bold text-slate-900 capitalize">{agentType} agent</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {result ? `Score ${result.score}/100 · ${result.decision}` : state === 'running' ? 'Analyzing policy constraints...' : 'Pending execution'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {state === 'completed' ? (
                    <CircleCheckBig className="h-5 w-5 text-emerald-600" />
                  ) : state === 'failed' ? (
                    <CircleAlert className="h-5 w-5 text-rose-600" />
                  ) : state === 'running' ? (
                    <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
                  ) : (
                    <Clock3 className="h-5 w-5 text-zinc-300" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-2 space-y-3">
          <div className="bg-white border border-zinc-200/60 p-5 rounded-2xl shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Live Agent Audit Feed</p>
            <div className="mt-4 space-y-3">
              {audit.slice(-8).map((entry) => (
                <div key={entry.id} className="rounded-xl border border-zinc-150 bg-zinc-50 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-1.5 mb-1.5">
                    <p className="font-bold uppercase text-violet-700">{entry.actor}</p>
                    <p className="text-[10px] text-slate-400 flex items-center">
                      <Clock3 className="w-3 h-3 mr-0.5" />
                      {new Date(entry.timestamp).toLocaleTimeString('en-GB')}
                    </p>
                  </div>
                  <p className="text-slate-600 leading-relaxed font-medium">{entry.message}</p>
                </div>
              ))}
              {audit.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400 font-medium">
                  Initializing orchestration steps...
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
