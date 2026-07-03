'use client';

import { useEffect, useMemo, useState } from 'react';
import { Lock, LockOpen, ShieldAlert, ShieldCheck, Timer, UserCog, Users, Eye, Gavel } from 'lucide-react';
import type { Role } from '@/lib/permissions/types';
import { ROLE_LABELS } from '@/lib/permissions/types';

interface AccessDecisionLike {
  allow: boolean;
  role: Role;
  field: string;
  classification: string;
  reason: string;
  ruleId: string;
  latencyMs: number;
  asOf: string;
}

interface AccessViewResponse {
  role: Role;
  asOf: string;
  application: { officerNotes?: string; applicantContact?: unknown; accessRevoked?: boolean; temporalUnlockDays?: number; status?: string };
  results: unknown[];
  decision: unknown;
  decisions: AccessDecisionLike[];
}

const ROLE_ICONS: Record<Role, React.ComponentType<{ className?: string }>> = {
  public: Users,
  applicant: Eye,
  'case-officer': UserCog,
  auditor: Gavel,
};

export default function AccessPanel({ applicationId }: { applicationId: string }) {
  const [role, setRole] = useState<Role>('public');
  const [daysOffset, setDaysOffset] = useState(0);
  const [view, setView] = useState<AccessViewResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const asOf = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString();
  }, [daysOffset]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/access?role=${role}&asOf=${encodeURIComponent(asOf)}`);
      const data = await res.json();
      setView(data);
      setNotesDraft(data.application?.officerNotes && data.application.officerNotes !== '[restricted — internal case officer note]' ? data.application.officerNotes : notesDraft);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional data fetch on role/date/id change
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, daysOffset, applicationId]);

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await fetch(`/api/applications/${applicationId}/officer-notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ officerNotes: notesDraft }),
      });
      await load();
    } finally {
      setSavingNotes(false);
    }
  };

  const toggleRevoke = async () => {
    await fetch(`/api/applications/${applicationId}/officer-notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessRevoked: !view?.application.accessRevoked }),
    });
    await load();
  };

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Permission-aware memory layer</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">View this case as a different role</p>
        </div>
        <ShieldCheck className="h-5 w-5 text-emerald-600" />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.keys(ROLE_LABELS) as Role[]).map((r) => {
          const Icon = ROLE_ICONS[r];
          return (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[10px] font-bold transition-colors ${
                role === r ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-zinc-200 bg-zinc-50 text-slate-500 hover:border-violet-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {ROLE_LABELS[r]}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> Temporal rule demo: simulate days since decision</span>
          <span>{daysOffset} day(s)</span>
        </div>
        <input
          type="range"
          min={0}
          max={45}
          value={daysOffset}
          onChange={(e) => setDaysOffset(Number(e.target.value))}
          className="mt-2 w-full accent-violet-600"
        />
        <p className="mt-1 text-[10px] text-slate-400">
          Officer notes are internal until 30 days after the decision, then unlock to Public automatically — no manual reclassification.
        </p>
      </div>

      {loading || !view ? (
        <p className="text-xs text-slate-400">Evaluating access…</p>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-zinc-200 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">What {ROLE_LABELS[role].toLowerCase()} sees</p>
            <p className="text-xs text-slate-600">
              <span className="font-semibold">Agent results &amp; final decision: </span>
              {view.results.length > 0 ? 'Visible' : 'Hidden (source revoked or record not yet public)'}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              <span className="font-semibold">Officer notes: </span>
              {view.application.officerNotes && view.application.officerNotes !== '[restricted — internal case officer note]'
                ? `"${view.application.officerNotes}"`
                : view.application.officerNotes === '[restricted — internal case officer note]'
                ? 'Restricted (internal)'
                : 'None recorded'}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              <span className="font-semibold">Applicant contact: </span>
              {view.application.applicantContact ? 'Visible' : 'Restricted / not provided'}
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Deterministic access decisions (this request)</p>
            {view.decisions.map((d, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1.5 text-[10px]">
                <span className="flex items-center gap-1.5 font-semibold text-slate-600">
                  {d.allow ? <LockOpen className="h-3 w-3 text-emerald-600" /> : <Lock className="h-3 w-3 text-rose-500" />}
                  {d.field} · {d.classification} · {d.ruleId}
                </span>
                <span className="text-slate-400">{d.latencyMs.toFixed(2)}ms</span>
              </div>
            ))}
            <p className="text-[10px] text-slate-400 pt-1">
              Every check above is a synchronous rule-table lookup (no LLM, no network call) — that is what keeps P99 latency in the sub-millisecond
              range shown, well inside the 200ms target. Full decisions are also written to the audit trail.
            </p>
          </div>

          {view.application.accessRevoked && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-semibold text-rose-700">
              <ShieldAlert className="h-3.5 w-3.5" /> Access to this application has been revoked — the restriction has propagated to every derived
              record (agent results, final decision, evidence) automatically, for every role except case officer / auditor.
            </div>
          )}
        </div>
      )}

      <div className="border-t border-zinc-100 pt-4 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Case officer actions (demo)</p>
        <textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          rows={2}
          placeholder="e.g. Applicant's agent called - contact number 07123 456789. Off the record: officer leans towards approval pending drainage note."
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs outline-none focus:border-violet-300"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={saveNotes}
            disabled={savingNotes}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {savingNotes ? 'Classifying & saving…' : 'Save internal note'}
          </button>
          <button
            onClick={toggleRevoke}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-bold ${
              view?.application.accessRevoked ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'border border-rose-200 text-rose-600 hover:bg-rose-50'
            }`}
          >
            {view?.application.accessRevoked ? 'Restore access' : 'Revoke source access'}
          </button>
        </div>
        <p className="text-[10px] text-slate-400">
          Try this: type a note containing a phone number and save it — it is auto-classified <span className="font-semibold">personal</span> at write
          time (heuristic, or an LLM if configured) and immediately hidden from the Public view above.
        </p>
      </div>
    </div>
  );
}
