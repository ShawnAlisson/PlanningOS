'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import {
  Activity,
  Eye,
  FileText,
  Gavel,
  GitBranch,
  Lock,
  LockOpen,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  UserCog,
  Users,
  Zap,
} from 'lucide-react';
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

const ROLE_ICONS: Record<Role, ComponentType<{ className?: string }>> = {
  public: Users,
  applicant: Eye,
  'case-officer': UserCog,
  auditor: Gavel,
};

const FIELD_LABELS: Record<string, string> = {
  summary: 'Agent memory',
  applicantContact: 'Applicant contact',
  officerNotes: 'Officer notes',
  auditTrail: 'Audit trail',
};

const ROLE_TAGLINES: Record<Role, string> = {
  public: 'Only public-safe memory leaves the firewall.',
  applicant: 'Personal case data can pass to the applicant.',
  'case-officer': 'Internal working memory stays available to officers.',
  auditor: 'Full traceability opens for compliance review.',
};

const ROLE_STORIES: Record<Role, { title: string; story: string; saveLine: string }> = {
  public: {
    title: 'Public register view',
    story: 'A neighbour or third party gets the planning outcome, but private applicant data and internal council notes stay sealed.',
    saveLine: 'Saves applicants from accidental exposure while still keeping the public record useful.',
  },
  applicant: {
    title: 'Applicant view',
    story: 'The applicant can see their own protected contact details and case outcome, without gaining access to internal officer working notes.',
    saveLine: 'Saves residents from black-box decisions while keeping council deliberation protected.',
  },
  'case-officer': {
    title: 'Case officer workspace',
    story: 'The officer can read and write internal notes, including sensitive contact details, because they are actively handling the case.',
    saveLine: 'Saves council teams from manual redaction and permission checks during live case work.',
  },
  auditor: {
    title: 'Compliance audit view',
    story: 'The auditor can inspect the full memory trail, rule IDs, and timing evidence to prove the access decision was lawful.',
    saveLine: 'Saves the AI workflow from becoming unverifiable when regulators ask how a decision was made.',
  },
};

const DEMO_PROTECTED_NOTE = "Applicant's agent called - contact number 07123 456789. Officer leans towards approval pending drainage note.";

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

  const activeDecisions = view?.decisions ?? [];
  const allowedCount = activeDecisions.filter((decision) => decision.allow).length;
  const deniedCount = activeDecisions.length - allowedCount;
  const fastestLatency = activeDecisions.length ? Math.min(...activeDecisions.map((decision) => decision.latencyMs)) : 0;
  const officerNote = view?.application.officerNotes;
  const notesVisible = Boolean(officerNote && officerNote !== '[restricted — internal case officer note]');
  const contactVisible = Boolean(view?.application.applicantContact);
  const resultsVisible = Boolean(view && view.results.length > 0);
  const publicTemporalUnlocked = role === 'public' && daysOffset >= (view?.application.temporalUnlockDays ?? 30);
  const roleStory = ROLE_STORIES[role];
  const protectedNoteDetail = notesVisible ? String(officerNote) : DEMO_PROTECTED_NOTE;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-xl shadow-slate-950/10">
      <div className="relative p-5 sm:p-6">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-emerald-300 to-fuchsia-300" />

        <div className="flex flex-col gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-100">
              <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
              BasedAI bounty: permission-aware memory
            </div>
            <h2 className="mt-3 text-2xl font-black leading-tight tracking-normal text-white sm:text-3xl">
              AI memory firewall for planning cases
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              This live card protects applicant data, officer notes, source ACLs, and derived agent memory at retrieval time. The read path is a
              deterministic rule-table lookup: no LLM call, no network call, audit logged.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="Allowed" value={loading ? '...' : String(allowedCount)} tone="emerald" />
            <Metric label="Denied" value={loading ? '...' : String(deniedCount)} tone="rose" />
            <Metric label="Fastest check" value={loading ? '...' : `${fastestLatency.toFixed(2)}ms`} tone="cyan" />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => {
            const Icon = ROLE_ICONS[r];
            const selected = role === r;
            return (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`min-h-24 rounded-lg border p-3 text-left transition-all ${
                  selected
                    ? 'border-cyan-300 bg-cyan-300/15 shadow-lg shadow-cyan-950/30'
                    : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/35 hover:bg-white/[0.07]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon className={selected ? 'h-5 w-5 text-cyan-200' : 'h-5 w-5 text-slate-400'} />
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${selected ? 'bg-cyan-200 text-slate-950' : 'bg-white/10 text-slate-400'}`}>
                    Role lens
                  </span>
                </div>
                <p className="mt-3 text-xs font-black leading-tight text-white">{ROLE_LABELS[r]}</p>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{ROLE_TAGLINES[r]}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-100">Live role preview: {ROLE_LABELS[role]}</p>
                <p className="mt-1 text-sm font-black leading-tight text-white">{roleStory.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{roleStory.story}</p>
              </div>
              <div className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-100">
                Permission gate is live
              </div>
            </div>

            {loading || !view ? (
              <div className="mt-4 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4 text-xs font-bold text-cyan-100">
                Evaluating access through deterministic rules...
              </div>
            ) : (
              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
                <div className="space-y-2">
                  <AccessOutcome
                    icon={FileText}
                    label="Final planning decision"
                    visible={resultsVisible}
                    allowedText="Shown to this role"
                    blockedText="Hidden because the source was revoked"
                    detail={resultsVisible ? 'Agent results and the final recommendation can be retrieved.' : 'The source case was revoked, so derived AI memory is closed too.'}
                  />
                  <AccessOutcome
                    icon={ShieldCheck}
                    label="Internal officer note"
                    visible={notesVisible}
                    allowedText="Shown"
                    blockedText="Protected"
                    detail={protectedNoteDetail}
                  />
                </div>

                <div className="hidden h-full min-h-44 flex-col items-center justify-center gap-2 lg:flex">
                  <div className="h-12 w-px bg-cyan-300/25" />
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/35 bg-slate-950 shadow-lg shadow-cyan-950/40">
                    <ShieldCheck className="h-8 w-8 text-cyan-200" />
                  </div>
                  <div className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-cyan-100">
                    Deterministic check
                  </div>
                  <div className="h-12 w-px bg-cyan-300/25" />
                </div>

                <div className="space-y-2">
                  <AccessOutcome
                    icon={Eye}
                    label="Applicant contact details"
                    visible={contactVisible}
                    allowedText="Shown"
                    blockedText="Protected"
                    detail={contactVisible ? 'This role can retrieve the applicant contact record.' : 'Phone numbers and personal contact data do not leave the gate.'}
                  />
                  <AccessOutcome
                    icon={Gavel}
                    label="Audit and rule evidence"
                    visible={role === 'auditor' || role === 'case-officer'}
                    allowedText="Inspectable"
                    blockedText="Summarised only"
                    detail={role === 'auditor' || role === 'case-officer' ? 'Rule IDs, allow/deny reasons, and timings are available for review.' : 'The public view gets the outcome, not internal access-check evidence.'}
                  />
                </div>
              </div>
            )}

            <div className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.07] p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Why sponsors should care</p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-50">{roleStory.saveLine}</p>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-100">30-day public disclosure rule</p>
                <p className="mt-1 text-xs text-slate-400">Move time forward and watch internal notes become public automatically after the decision window.</p>
              </div>
              <Timer className={publicTemporalUnlocked ? 'h-5 w-5 text-emerald-300' : 'h-5 w-5 text-fuchsia-200'} />
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Decision day</span>
                <span className={publicTemporalUnlocked ? 'text-emerald-200' : 'text-fuchsia-100'}>{daysOffset} day(s)</span>
              </div>
              <input
                type="range"
                min={0}
                max={45}
                value={daysOffset}
                onChange={(e) => setDaysOffset(Number(e.target.value))}
                className="w-full accent-cyan-300"
              />
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="h-1 rounded-full bg-fuchsia-300/40" />
                <div className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest ${daysOffset >= 30 ? 'border-emerald-300/50 bg-emerald-300/15 text-emerald-100' : 'border-fuchsia-300/40 bg-fuchsia-300/10 text-fuchsia-100'}`}>
                  Day 30 unlock
                </div>
                <div className="h-1 rounded-full bg-emerald-300/40" />
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.07] p-3">
              <div className="flex items-start gap-3">
                <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
                <p className="text-xs leading-relaxed text-cyan-50">
                  Source permissions govern every AI memory derived from the case. Revoke the source below and summaries, decisions, notes, and evidence
                  close automatically for public and applicant views.
                </p>
              </div>
            </div>
          </div>
        </div>

        {view?.application.accessRevoked && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-rose-300/35 bg-rose-400/10 px-4 py-3 text-xs font-semibold leading-relaxed text-rose-50">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-200" />
            Source access is revoked. The restriction has propagated to agent results, final decision, evidence, and other derived memory for every
            role except case officer and auditor.
          </div>
        )}

        <div className="mt-4 grid gap-4 2xl:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Deterministic audit receipts</p>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-100">
                <Zap className="h-3 w-3" />
                No LLM on read
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {(view?.decisions ?? []).map((decision, i) => (
                <div key={`${decision.field}-${i}`} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-slate-950/65 px-3 py-2 text-[10px]">
                  <span className="flex min-w-0 items-center gap-2 font-bold text-slate-200">
                    {decision.allow ? <LockOpen className="h-3.5 w-3.5 shrink-0 text-emerald-300" /> : <Lock className="h-3.5 w-3.5 shrink-0 text-rose-300" />}
                    <span className="truncate">
                      {FIELD_LABELS[decision.field] ?? decision.field} / {decision.classification} / {decision.ruleId}
                    </span>
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 font-black text-cyan-100">{decision.latencyMs.toFixed(2)}ms</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
              Every request above is enforced at retrieval with a synchronous rule lookup, then written to the audit trail for compliance review.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Case officer writes protected memory</p>
                <p className="mt-1 text-xs text-slate-400">Add a sensitive note once. The system classifies it, then every role sees only what they are allowed to see.</p>
              </div>
              <Activity className="h-5 w-5 text-emerald-300" />
            </div>

            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={3}
              placeholder="Try: Applicant's agent called - contact number 07123 456789. Off the record: officer leans towards approval pending drainage note."
              className="mt-3 w-full resize-none rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/60"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-950 hover:bg-cyan-200 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {savingNotes ? 'Classifying...' : 'Save protected note'}
              </button>
              <button
                onClick={toggleRevoke}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest ${
                  view?.application.accessRevoked
                    ? 'bg-emerald-300 text-slate-950 hover:bg-emerald-200'
                    : 'border border-rose-300/35 bg-rose-400/10 text-rose-100 hover:bg-rose-400/15'
                }`}
              >
                {view?.application.accessRevoked ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                {view?.application.accessRevoked ? 'Restore source' : 'Revoke source ACL'}
              </button>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
              Fast sponsor demo: save the example note, switch between Public, Applicant, Officer, and Auditor, then drag the 30-day rule forward.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'cyan' | 'emerald' | 'rose' }) {
  const toneClass = {
    cyan: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100',
    emerald: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100',
    rose: 'border-rose-300/25 bg-rose-300/10 text-rose-100',
  }[tone];

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-lg font-black leading-none text-white">{value}</p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-widest opacity-80">{label}</p>
    </div>
  );
}

function AccessOutcome({
  icon: Icon,
  label,
  visible,
  allowedText,
  blockedText,
  detail,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  visible: boolean;
  allowedText: string;
  blockedText: string;
  detail: string;
}) {
  return (
    <div className={`min-h-28 rounded-lg border p-3 ${visible ? 'border-emerald-300/25 bg-emerald-300/10' : 'border-rose-300/20 bg-slate-950/65'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className={visible ? 'h-4 w-4 shrink-0 text-emerald-200' : 'h-4 w-4 shrink-0 text-rose-200'} />
          <p className="text-xs font-black leading-tight text-white">{label}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${visible ? 'bg-emerald-300 text-slate-950' : 'bg-rose-300/15 text-rose-100'}`}>
          {visible ? allowedText : blockedText}
        </span>
      </div>
      <p className={`mt-2 line-clamp-3 text-[10px] leading-relaxed ${visible ? 'text-emerald-50' : 'text-slate-400'}`}>{detail}</p>
    </div>
  );
}
