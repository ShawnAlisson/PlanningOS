import {
  ArrowRight,
  Bot,
  Car,
  CheckCircle2,
  Clock,
  Coins,
  FileSearch,
  FileText,
  GitBranch,
  Home,
  Hourglass,
  Landmark,
  ShieldCheck,
  Sparkles,
  Waves,
  Zap,
} from 'lucide-react';

interface ImpactPanelProps {
  agentCount: number;
  elapsedSeconds?: number;
}

// Rough, transparently-labelled UK householder planning benchmarks used purely
// to illustrate the scale of the problem this tool targets (Conduct AI track:
// take a slow enterprise/public-sector process and compress it to hours).
const TRADITIONAL_WEEKS_LOW = 8;
const TRADITIONAL_WEEKS_HIGH = 16;
const TRADITIONAL_COST_LOW = 1500;
const TRADITIONAL_COST_HIGH = 6000;
const AGENT_LANES = [
  { label: 'Policy', icon: FileSearch },
  { label: 'Heritage', icon: Landmark },
  { label: 'Flood', icon: Waves },
  { label: 'Highways', icon: Car },
  { label: 'Amenity', icon: Home },
];

export default function ImpactPanel({ agentCount, elapsedSeconds = 8 }: ImpactPanelProps) {
  const agentLabel = `${agentCount} specialist agent${agentCount === 1 ? '' : 's'}`;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950 text-white shadow-sm">
      <div className="relative p-5 sm:p-6">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-300" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cyan-100">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              Conduct track: Make Legacy Move
            </div>
            <h2 className="mt-3 text-2xl font-black leading-tight tracking-normal text-white sm:text-3xl">
              Legacy planning work, turned into an agent run
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              PlanningOS takes the slow enterprise pattern Conduct calls out - scarce experts manually tracing old rules, data, and dependencies - and
              compresses it into a controlled, evidence-linked workflow.
            </p>
          </div>

          <div className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">Saved per first-pass review</p>
            <p className="mt-1 text-2xl font-black text-white">{TRADITIONAL_WEEKS_LOW}-{TRADITIONAL_WEEKS_HIGH} weeks</p>
            <p className="text-xs font-semibold text-emerald-100">and GBP {TRADITIONAL_COST_LOW.toLocaleString()}-{TRADITIONAL_COST_HIGH.toLocaleString()} in typical fees</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto_1.2fr] lg:items-stretch">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Before</p>
              <Hourglass className="h-4 w-4 text-amber-300" />
            </div>
            <div className="mt-4 space-y-2">
              <LegacyRow icon={Clock} label="Council / consultant cycle" value={`${TRADITIONAL_WEEKS_LOW}-${TRADITIONAL_WEEKS_HIGH} weeks`} />
              <LegacyRow icon={Coins} label="Applicant spend" value={`GBP ${TRADITIONAL_COST_LOW.toLocaleString()}-${TRADITIONAL_COST_HIGH.toLocaleString()}`} />
              <LegacyRow icon={GitBranch} label="Manual cross-checks" value="Policy, heritage, flood, highways, neighbours" />
            </div>
            <LegacyBacklogVisual />
          </div>

          <div className="hidden w-16 items-center justify-center lg:flex">
            <div className="flex h-full w-full items-center">
              <div className="h-px flex-1 bg-cyan-300/35" />
              <div className="rounded-full border border-cyan-300/40 bg-cyan-300/15 p-2">
                <ArrowRight className="h-5 w-5 text-cyan-200" />
              </div>
              <div className="h-px flex-1 bg-cyan-300/35" />
            </div>
          </div>

          <div className="rounded-lg border border-cyan-300/25 bg-cyan-300/[0.07] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-100">After</p>
              <Zap className="h-4 w-4 text-cyan-200" />
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-white/10 bg-slate-950/55 p-4">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-cyan-300" />
                  <p className="text-sm font-black text-white">~{elapsedSeconds}s agent pass</p>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">{agentLabel} run policy, heritage, flood, highways, and amenity checks in parallel.</p>
                <AgentRunVisual />
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Outcome icon={CheckCircle2} label="Evidence links survive the compression" />
                <Outcome icon={ShieldCheck} label="Officer judgement and consultation stay in control" />
                <Outcome icon={Sparkles} label="Specialists spend time on judgement calls, not paperwork" />
              </div>
            </div>
          </div>
        </div>

        <p className="mt-5 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-slate-400">
          This does not replace the case officer&apos;s judgement or statutory consultation. It removes the weeks-long bottleneck of manually
          cross-referencing policy, heritage, flood, highways, and neighbour constraints so officers and applicants can focus on the decisions that
          actually need human judgement.
        </p>
      </div>
    </div>
  );
}

function LegacyBacklogVisual() {
  return (
    <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-3" aria-label="Manual legacy planning backlog">
      <div className="relative mx-auto h-28 max-w-sm overflow-hidden">
        <div className="absolute left-1 top-3 h-20 w-[42%] rounded-md border border-amber-200/25 bg-slate-950/80 shadow-lg shadow-black/20" />
        <div className="absolute left-5 top-6 h-20 w-[42%] rounded-md border border-amber-200/30 bg-slate-900 shadow-lg shadow-black/20" />
        <div className="absolute left-9 top-9 h-20 w-[42%] rounded-md border border-amber-200/35 bg-slate-800 p-3 shadow-lg shadow-black/20">
          <FileText className="h-4 w-4 text-amber-300" />
          <div className="mt-3 h-1.5 w-20 rounded-full bg-amber-200/30" />
          <div className="mt-2 h-1.5 w-14 rounded-full bg-amber-200/20" />
        </div>
        <div className="absolute right-2 top-4 flex h-24 w-[44%] flex-col justify-between rounded-md border border-white/10 bg-slate-950/70 p-3">
          {['Policy PDF', 'GIS layer', 'Site note', 'Case history'].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-300" />
              <div className="h-1.5 flex-1 rounded-full bg-white/12" />
            </div>
          ))}
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-amber-100">
          serial expert queue
        </div>
      </div>
    </div>
  );
}

function AgentRunVisual() {
  return (
    <div className="mt-4 rounded-lg border border-cyan-300/20 bg-slate-950/70 p-3" aria-label="Application evidence split across specialist planning agents">
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-cyan-300/25 bg-cyan-300/10">
          <FileText className="h-5 w-5 text-cyan-200" />
        </div>
        <div className="h-px flex-1 bg-cyan-300/30" />
        <div className="rounded-full border border-cyan-300/35 bg-cyan-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-cyan-100">
          split
        </div>
      </div>

      <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${AGENT_LANES.length}, minmax(0, 1fr))` }}>
        {AGENT_LANES.map(({ label, icon: Icon }) => (
          <div key={label} className="min-w-0 rounded-md border border-cyan-300/25 bg-cyan-300/10 p-2 text-center">
            <Icon className="mx-auto h-4 w-4 text-cyan-200" />
            <p className="mt-1 truncate text-[9px] font-bold text-cyan-50">{label}</p>
            <div className="mx-auto mt-2 h-1 w-full max-w-8 rounded-full bg-emerald-300/60" />
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="h-px flex-1 bg-emerald-300/30" />
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-300/35 bg-emerald-300/15">
          <CheckCircle2 className="h-5 w-5 text-emerald-200" />
        </div>
        <div className="h-px flex-1 bg-emerald-300/30" />
      </div>
      <p className="mt-2 text-center text-[9px] font-black uppercase tracking-widest text-emerald-100">joined evidence pack</p>
    </div>
  );
}

function LegacyRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-white/10 bg-slate-900/70 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
      <div className="min-w-0">
        <p className="text-sm font-black leading-tight text-white">{value}</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function Outcome({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
      <p className="text-xs font-semibold leading-relaxed text-emerald-50">{label}</p>
    </div>
  );
}
