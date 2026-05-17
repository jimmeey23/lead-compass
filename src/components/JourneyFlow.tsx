import { useMemo } from 'react';
import {
  ArrowDownRight,
  CircleDollarSign,
  Droplets,
  Goal,
  Route,
  TrendingDown,
  Trophy,
  Waves,
} from 'lucide-react';
import type { Lead } from '@/types/leads';
import type { JourneyBranch, JourneyStage, JourneyStageKey } from '@/lib/journey-flow';
import { buildJourneyFlow } from '@/lib/journey-flow';
import { cn } from '@/lib/utils';

interface JourneyFlowProps {
  leads: Lead[];
}

const NODE_POSITIONS = {
  source: { x: 56, y: 170 },
  newLead: { x: 214, y: 92 },
  contacted: { x: 384, y: 138 },
  trialScheduled: { x: 554, y: 188 },
  trialCompleted: { x: 732, y: 132 },
  converted: { x: 912, y: 170 },
} as const satisfies Record<JourneyStageKey, { x: number; y: number }>;

const STAGE_COLORS = {
  source: '#7f1231',
  newLead: '#9f1d4c',
  contacted: '#c2416b',
  trialScheduled: '#e96f78',
  trialCompleted: '#f4a261',
  converted: '#2f855a',
} as const satisfies Record<JourneyStageKey, string>;

const BRANCH_META = {
  noResponse: {
    path: 'M394 126 C470 42, 580 46, 690 72',
    labelX: 636,
    labelY: 46,
    color: '#64748b',
  },
  trialNotAttended: {
    path: 'M558 201 C612 272, 720 284, 820 248',
    labelX: 706,
    labelY: 282,
    color: '#d97706',
  },
  lost: {
    path: 'M402 151 C494 208, 580 246, 690 236',
    labelX: 610,
    labelY: 225,
    color: '#475569',
  },
} as const;

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(value);
}

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getStrokeWidth(count: number, total: number, min = 12, max = 70): number {
  if (total <= 0 || count <= 0) return min;
  return Math.max(min, Math.min(max, min + (count / total) * (max - min)));
}

function InsightTile({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'default',
}: {
  icon: typeof Route;
  label: string;
  value: string;
  detail: string;
  tone?: 'default' | 'success' | 'warning' | 'muted';
}) {
  const toneClass = {
    default: 'border-sky-200/70 bg-sky-50/80 text-sky-950 dark:border-sky-400/20 dark:bg-sky-950/20 dark:text-sky-100',
    success: 'border-emerald-200/70 bg-emerald-50/80 text-emerald-950 dark:border-emerald-400/20 dark:bg-emerald-950/20 dark:text-emerald-100',
    warning: 'border-amber-200/80 bg-amber-50/85 text-amber-950 dark:border-amber-400/20 dark:bg-amber-950/20 dark:text-amber-100',
    muted: 'border-slate-200/80 bg-slate-50/90 text-slate-950 dark:border-slate-500/20 dark:bg-slate-900/50 dark:text-slate-100',
  }[tone];

  return (
    <div className={cn('rounded-xl border p-4 shadow-sm', toneClass)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/70 shadow-sm dark:bg-white/10">
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-right text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">{label}</p>
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs leading-relaxed opacity-75">{detail}</p>
    </div>
  );
}

function StageNode({ stage }: { stage: JourneyStage }) {
  const position = NODE_POSITIONS[stage.key];
  const fill = STAGE_COLORS[stage.key];
  const percentLabel = `${formatPercent(stage.percentage)} of leads`;
  const previousLabel = stage.previousConversionRate === null ? 'Entry pool' : `${formatPercent(stage.previousConversionRate)} from previous`;

  return (
    <g>
      <circle cx={position.x} cy={position.y} r="31" fill={fill} stroke="white" strokeWidth="7" filter="url(#nodeShadow)" />
      <text x={position.x} y={position.y + 5} textAnchor="middle" fill="white" fontSize="15" fontWeight="800">
        {formatNumber(stage.count)}
      </text>
      <foreignObject x={position.x - 70} y={position.y + 44} width="140" height="70">
        <div className="rounded-lg border border-slate-200/80 bg-white/95 px-2.5 py-2 text-center shadow-sm dark:border-white/15 dark:bg-slate-950/95">
          <p className="truncate text-[11px] font-bold text-slate-950 dark:text-white">{stage.label}</p>
          <p className="mt-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-300">{percentLabel}</p>
          <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-400">{previousLabel}</p>
        </div>
      </foreignObject>
    </g>
  );
}

function BranchLabel({ branch }: { branch: JourneyBranch }) {
  const meta = BRANCH_META[branch.key];

  return (
    <foreignObject x={meta.labelX - 76} y={meta.labelY - 22} width="152" height="48">
      <div className="rounded-lg border border-white/70 bg-white/90 px-2.5 py-1.5 text-center shadow-sm dark:border-white/10 dark:bg-slate-950/90">
        <p className="truncate text-[10px] font-bold text-slate-900 dark:text-white">{branch.label}</p>
        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-300">
          {formatNumber(branch.count)} leads • {formatPercent(branch.percentage)}
        </p>
      </div>
    </foreignObject>
  );
}

export function JourneyFlow({ leads }: JourneyFlowProps) {
  const flow = useMemo(() => buildJourneyFlow(leads), [leads]);
  const sourceStage = flow.stages.find((stage) => stage.key === 'source');
  const convertedStage = flow.stages.find((stage) => stage.key === 'converted');
  const trialCompletedStage = flow.stages.find((stage) => stage.key === 'trialCompleted');
  const mainStroke = getStrokeWidth(sourceStage?.count ?? 0, flow.totalLeads, 34, 78);

  if (leads.length === 0) {
    return (
      <section className="lux-panel rounded-2xl p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Waves className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-foreground">No journey data in this filter</h2>
        <p className="mt-1 text-sm text-muted-foreground">Adjust filters to see how leads move from source to conversion.</p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="lux-panel overflow-hidden rounded-2xl">
        <div className="border-b border-border/70 bg-card/95 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-[0_14px_30px_-18px_rgba(127,18,49,0.55)]">
                <Waves className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground">Journey Flow</h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                  Source to New Lead to Contacted to Trial Scheduled to Trial Completed to Converted, with visible exits for no response, missed trials, and lost leads.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
              <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Leads</p>
                <p className="mt-1 text-lg font-bold text-foreground">{formatNumber(flow.totalLeads)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Converted</p>
                <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatNumber(convertedStage?.count ?? 0)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Trial Done</p>
                <p className="mt-1 text-lg font-bold text-amber-700 dark:text-amber-300">{formatNumber(trialCompletedStage?.count ?? 0)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[linear-gradient(180deg,hsl(var(--muted)/0.26),hsl(var(--background)/0.72))] p-4">
          <div className="lead-scroll-area overflow-x-auto rounded-xl border border-border/70 bg-white/82 shadow-inner dark:bg-slate-950/40">
            <svg viewBox="0 0 980 360" className="h-[360px] min-w-[980px]">
              <defs>
                <linearGradient id="journeyRiver" x1="0" x2="1">
                  <stop offset="0%" stopColor="#7f1231" />
                  <stop offset="28%" stopColor="#c2416b" />
                  <stop offset="58%" stopColor="#f4a261" />
                  <stop offset="100%" stopColor="#2f855a" />
                </linearGradient>
                <filter id="nodeShadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#0f172a" floodOpacity="0.18" />
                </filter>
              </defs>
              <rect x="0" y="0" width="980" height="360" fill="transparent" />
              <path
                d="M64 170 C150 78, 226 78, 330 132 S520 230, 640 178 S820 90, 920 170"
                fill="none"
                stroke="url(#journeyRiver)"
                strokeWidth={mainStroke}
                strokeLinecap="round"
                opacity="0.92"
              />
              <path
                d="M64 170 C150 78, 226 78, 330 132 S520 230, 640 178 S820 90, 920 170"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.58"
              />

              {flow.branches.map((branch) => {
                const meta = BRANCH_META[branch.key];
                return (
                  <path
                    key={branch.key}
                    d={meta.path}
                    fill="none"
                    stroke={meta.color}
                    strokeWidth={getStrokeWidth(branch.count, flow.totalLeads, 9, 28)}
                    strokeLinecap="round"
                    opacity={branch.count > 0 ? 0.78 : 0.18}
                  />
                );
              })}

              {flow.stages.map((stage) => (
                <StageNode key={stage.key} stage={stage} />
              ))}
              {flow.branches.map((branch) => (
                <BranchLabel key={branch.key} branch={branch} />
              ))}
            </svg>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <InsightTile
          icon={Trophy}
          label="Conversion"
          value={formatPercent(flow.insights.conversionRate)}
          detail={`${formatNumber(convertedStage?.count ?? 0)} converted from filtered leads`}
          tone="success"
        />
        <InsightTile
          icon={Goal}
          label="Trial Yield"
          value={formatPercent(flow.insights.trialYield)}
          detail="Converted as a share of completed trials"
          tone="warning"
        />
        <InsightTile
          icon={TrendingDown}
          label="Leakage"
          value={flow.insights.biggestLeakage?.label ?? 'None'}
          detail={`${formatNumber(flow.insights.biggestLeakage?.count ?? 0)} leads at the largest exit`}
          tone="muted"
        />
        <InsightTile
          icon={Droplets}
          label="Top Source"
          value={flow.insights.topSource?.label ?? 'None'}
          detail={`${formatNumber(flow.insights.topSource?.count ?? 0)} leads entering the journey`}
        />
        <InsightTile
          icon={CircleDollarSign}
          label="Converted LTV"
          value={formatCurrency(flow.insights.convertedLtv)}
          detail="Revenue attached to converted leads"
          tone="success"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="lux-panel rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Source Feed</h3>
              <p className="mt-1 text-xs text-muted-foreground">Top acquisition sources in the filtered journey.</p>
            </div>
            <Route className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {flow.sources.map((source) => (
              <div key={source.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-semibold text-foreground">{source.label}</span>
                  <span className="font-mono-data text-muted-foreground">{formatNumber(source.count)} • {formatPercent(source.percentage)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#7f1231,#c2416b,#2f855a)]"
                    style={{ width: `${Math.max(4, source.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lux-panel rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Branch Exits</h3>
              <p className="mt-1 text-xs text-muted-foreground">Where leads leave or stall before conversion.</p>
            </div>
            <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {flow.branches.map((branch) => (
              <div key={branch.key} className="rounded-xl border border-border/70 bg-background/75 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-foreground">{branch.label}</p>
                  <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">{formatPercent(branch.percentage)}</span>
                </div>
                <p className="mt-3 text-2xl font-bold text-foreground">{formatNumber(branch.count)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Branches from {flow.stages.find((stage) => stage.key === branch.fromStageKey)?.label ?? 'journey'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
