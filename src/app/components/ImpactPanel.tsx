import { Clock, Coins, TrendingDown, Zap } from 'lucide-react';

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

export default function ImpactPanel({ agentCount, elapsedSeconds = 8 }: ImpactPanelProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-300">Weeks of consultant time, compressed</p>
        <Zap className="h-5 w-5 text-amber-400" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat icon={Clock} label="Typical council/consultant turnaround" value={`${TRADITIONAL_WEEKS_LOW}–${TRADITIONAL_WEEKS_HIGH} weeks`} />
        <Stat icon={Coins} label="Typical consultant fees" value={`£${TRADITIONAL_COST_LOW.toLocaleString()}–£${TRADITIONAL_COST_HIGH.toLocaleString()}`} />
        <Stat icon={TrendingDown} label="PlanningOS turnaround" value={`~${elapsedSeconds}s (${agentCount} specialist agents, parallel)`} accent />
        <Stat icon={Zap} label="Human decision" value="Always kept in the loop" accent />
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
        This does not replace the case officer&apos;s judgement or statutory consultation — it removes the weeks-long bottleneck of manually cross-referencing
        policy, heritage, flood, highways, and neighbour constraints so officers and applicants spend their time on genuine judgement calls, not paperwork.
      </p>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-white/10 bg-white/5'}`}>
      <Icon className={`h-4 w-4 ${accent ? 'text-emerald-400' : 'text-slate-300'}`} />
      <p className="mt-2 text-sm font-bold">{value}</p>
      <p className="mt-0.5 text-[10px] text-slate-400">{label}</p>
    </div>
  );
}
