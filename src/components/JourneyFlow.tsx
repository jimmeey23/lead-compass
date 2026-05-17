import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  ArrowDownRight,
  CircleDollarSign,
  Copy,
  Droplets,
  Goal,
  Route,
  TrendingDown,
  Trophy,
  Waves,
} from 'lucide-react';
import type { Lead } from '@/types/leads';
import type { JourneyBranch, JourneyBranchKey, JourneyStage, JourneyStageKey } from '@/lib/journey-flow';
import { buildJourneyFlow, getJourneyBranchLeads, getJourneySourceLeads, getJourneyStageLeads } from '@/lib/journey-flow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cleanLooseText, isSalesConvertedLead, normalizePersonName, parseFlexibleDate } from '@/lib/lead-utils';
import { cn } from '@/lib/utils';

interface JourneyFlowProps {
  leads: Lead[];
}

const NODE_POSITIONS = {
  source: { x: 72, y: 210 },
  newLead: { x: 284, y: 112 },
  contacted: { x: 500, y: 172 },
  trialScheduled: { x: 716, y: 246 },
  trialCompleted: { x: 928, y: 160 },
  converted: { x: 1140, y: 210 },
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
    path: 'M510 152 C600 54, 742 42, 892 68',
    labelX: 842,
    labelY: 44,
    color: '#64748b',
  },
  trialNotAttended: {
    path: 'M724 264 C800 356, 932 368, 1088 326',
    labelX: 944,
    labelY: 360,
    color: '#d97706',
  },
  lost: {
    path: 'M510 194 C560 286, 492 354, 350 360',
    labelX: 392,
    labelY: 384,
    color: '#475569',
  },
} as const;

type DrilldownTarget =
  | { type: 'stage'; key: JourneyStageKey; label: string }
  | { type: 'branch'; key: JourneyBranchKey; label: string }
  | { type: 'source'; label: string };

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

function formatDate(value: string): string {
  const date = parseFlexibleDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function getFollowUpCompletion(lead: Lead): string {
  const completed = lead.followUps.filter((followUp) => cleanLooseText(followUp.date) || cleanLooseText(followUp.comment)).length;
  return `${completed}/4`;
}

function getAverageConversionSpan(leads: Lead[]): number | null {
  const spans = leads
    .filter(isSalesConvertedLead)
    .map((lead) => {
      const createdAt = parseFlexibleDate(lead.createdAt);
      const convertedAt = parseFlexibleDate(lead.convertedAt);
      if (!createdAt || !convertedAt) return null;
      return Math.max(0, Math.round((convertedAt.getTime() - createdAt.getTime()) / 86400000));
    })
    .filter((value): value is number => value !== null);
  if (spans.length === 0) return null;
  return spans.reduce((sum, span) => sum + span, 0) / spans.length;
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

function StageNode({ stage, onSelect }: { stage: JourneyStage; onSelect: () => void }) {
  const position = NODE_POSITIONS[stage.key];
  const fill = STAGE_COLORS[stage.key];
  const percentLabel = `${formatPercent(stage.percentage)} of leads`;
  const previousLabel = stage.previousConversionRate === null ? 'Entry pool' : `${formatPercent(stage.previousConversionRate)} from previous`;
  const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Open drill down for ${stage.label}`}
      className="cursor-pointer outline-none transition-opacity hover:opacity-90 focus-visible:opacity-90"
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <circle cx={position.x} cy={position.y} r="31" fill={fill} stroke="white" strokeWidth="7" filter="url(#nodeShadow)" />
      <circle cx={position.x} cy={position.y} r="42" fill="transparent" stroke={fill} strokeWidth="1.5" strokeDasharray="4 5" opacity="0.46" />
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

function BranchLabel({ branch, onSelect }: { branch: JourneyBranch; onSelect: () => void }) {
  const meta = BRANCH_META[branch.key];

  return (
    <foreignObject x={meta.labelX - 82} y={meta.labelY - 22} width="164" height="52">
      <div className="rounded-lg border border-white/70 bg-white/90 px-2.5 py-1.5 text-center shadow-sm dark:border-white/10 dark:bg-slate-950/90">
        <button type="button" className="w-full cursor-pointer text-center" onClick={onSelect}>
          <p className="truncate text-[10px] font-bold text-slate-900 dark:text-white">{branch.label}</p>
        </button>
        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-300">
          {formatNumber(branch.count)} leads • {formatPercent(branch.percentage)}
        </p>
      </div>
    </foreignObject>
  );
}

export function JourneyFlow({ leads }: JourneyFlowProps) {
  const [selectedTarget, setSelectedTarget] = useState<DrilldownTarget | null>(null);
  const flow = useMemo(() => buildJourneyFlow(leads), [leads]);
  const sourceStage = flow.stages.find((stage) => stage.key === 'source');
  const convertedStage = flow.stages.find((stage) => stage.key === 'converted');
  const trialCompletedStage = flow.stages.find((stage) => stage.key === 'trialCompleted');
  const mainStroke = getStrokeWidth(sourceStage?.count ?? 0, flow.totalLeads, 34, 78);
  const selectedLeads = useMemo(() => {
    if (!selectedTarget) return [];
    if (selectedTarget.type === 'stage') return getJourneyStageLeads(leads, selectedTarget.key);
    if (selectedTarget.type === 'branch') return getJourneyBranchLeads(leads, selectedTarget.key);
    return getJourneySourceLeads(leads, selectedTarget.label);
  }, [leads, selectedTarget]);
  const selectedFlow = useMemo(() => buildJourneyFlow(selectedLeads), [selectedLeads]);
  const selectedConverted = selectedFlow.stages.find((stage) => stage.key === 'converted')?.count ?? 0;
  const selectedTrialCompleted = selectedFlow.stages.find((stage) => stage.key === 'trialCompleted')?.count ?? 0;
  const selectedLtv = selectedLeads.reduce((sum, lead) => sum + (isSalesConvertedLead(lead) ? Number(lead.ltv) || 0 : 0), 0);
  const averageConversionSpan = getAverageConversionSpan(selectedLeads);
  const averageVisits = selectedLeads.length ? selectedLeads.reduce((sum, lead) => sum + (Number(lead.visits) || 0), 0) / selectedLeads.length : 0;
  const averageFollowUps = selectedLeads.length ? selectedLeads.reduce((sum, lead) => sum + lead.followUps.length, 0) / selectedLeads.length : 0;
  const modalLeadRows = selectedLeads.slice(0, 120);
  const copySelectedNames = () => {
    void navigator.clipboard?.writeText(selectedLeads.map((lead) => normalizePersonName(lead.fullName) || lead.fullName || lead.id).join('\n'));
  };

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
          <div className="lead-scroll-area overflow-x-auto rounded-xl border border-border/70 bg-white/88 shadow-inner dark:bg-slate-950/50">
            <svg viewBox="0 0 1220 430" className="h-[430px] w-full min-w-[1180px]">
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
              <rect x="0" y="0" width="1220" height="430" fill="transparent" />
              <path d="M50 60 H1170 M50 160 H1170 M50 260 H1170 M50 360 H1170" stroke="#94a3b8" strokeWidth="1" opacity="0.13" />
              <path
                d="M80 210 C190 82, 310 80, 440 150 S660 302, 804 214 S1012 92, 1140 210"
                fill="none"
                stroke="url(#journeyRiver)"
                strokeWidth={mainStroke}
                strokeLinecap="round"
                opacity="0.92"
              />
              <path
                d="M80 210 C190 82, 310 80, 440 150 S660 302, 804 214 S1012 92, 1140 210"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.58"
              />

              {flow.branches.map((branch) => {
                const meta = BRANCH_META[branch.key];
                const branchStrokeWidth = getStrokeWidth(branch.count, flow.totalLeads, 4, 15);
                return (
                  <g key={branch.key}>
                    <path
                      d={meta.path}
                      fill="none"
                      stroke={meta.color}
                      strokeWidth={branchStrokeWidth}
                      strokeLinecap="round"
                      opacity={branch.count > 0 ? 0.78 : 0.18}
                      className="cursor-pointer transition-opacity hover:opacity-100"
                      onClick={() => setSelectedTarget({ type: 'branch', key: branch.key, label: branch.label })}
                    />
                    <path
                      d={meta.path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={Math.max(26, branchStrokeWidth + 16)}
                      strokeLinecap="round"
                      className="cursor-pointer"
                      onClick={() => setSelectedTarget({ type: 'branch', key: branch.key, label: branch.label })}
                    />
                  </g>
                );
              })}

              {flow.stages.map((stage) => (
                <StageNode key={stage.key} stage={stage} onSelect={() => setSelectedTarget({ type: 'stage', key: stage.key, label: stage.label })} />
              ))}
              {flow.branches.map((branch) => (
                <BranchLabel key={branch.key} branch={branch} onSelect={() => setSelectedTarget({ type: 'branch', key: branch.key, label: branch.label })} />
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
              <button
                key={source.label}
                type="button"
                className="theme-contrast-hover w-full rounded-xl border border-transparent p-2 text-left transition-colors"
                onClick={() => setSelectedTarget({ type: 'source', label: source.label })}
              >
                <div className="space-y-1.5">
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
              </button>
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
              <button
                key={branch.key}
                type="button"
                className="theme-contrast-hover rounded-xl border border-border/70 bg-background/75 p-4 text-left transition-colors"
                onClick={() => setSelectedTarget({ type: 'branch', key: branch.key, label: branch.label })}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-foreground">{branch.label}</p>
                  <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">{formatPercent(branch.percentage)}</span>
                </div>
                <p className="mt-3 text-2xl font-bold text-foreground">{formatNumber(branch.count)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Branches from {flow.stages.find((stage) => stage.key === branch.fromStageKey)?.label ?? 'journey'}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>
      <Dialog open={Boolean(selectedTarget)} onOpenChange={(open) => !open && setSelectedTarget(null)}>
        <DialogContent className="max-h-[90vh] overflow-hidden rounded-3xl border-border/50 bg-background/98 p-0 sm:max-w-5xl">
          <div className="border-b border-border/70 bg-muted/30 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
                <span>{selectedTarget?.label ?? 'Journey Drill Down'}</span>
                {selectedTarget && <Badge variant="outline" className="rounded-full capitalize">{selectedTarget.type}</Badge>}
              </DialogTitle>
              <DialogDescription>
                Detailed lead analytics for the selected journey milestone, source, or branch.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="lead-scroll-area max-h-[calc(90vh-112px)] overflow-y-auto px-6 py-5">
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-xl border border-border/70 bg-card p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Leads</p>
                <p className="mt-2 text-xl font-bold text-foreground">{formatNumber(selectedLeads.length)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Converted</p>
                <p className="mt-2 text-xl font-bold text-emerald-700 dark:text-emerald-300">{formatNumber(selectedConverted)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Trial Done</p>
                <p className="mt-2 text-xl font-bold text-amber-700 dark:text-amber-300">{formatNumber(selectedTrialCompleted)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">LTV</p>
                <p className="mt-2 text-xl font-bold text-foreground">{formatCurrency(selectedLtv)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Avg Span</p>
                <p className="mt-2 text-xl font-bold text-foreground">{averageConversionSpan === null ? '-' : `${formatNumber(averageConversionSpan)}d`}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Avg Touches</p>
                <p className="mt-2 text-xl font-bold text-foreground">{formatNumber(averageFollowUps)}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Lead Details</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Showing {formatNumber(modalLeadRows.length)} of {formatNumber(selectedLeads.length)} leads. Avg visits: {formatNumber(averageVisits)}.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={copySelectedNames}>
                <Copy className="mr-2 h-3.5 w-3.5" />
                Copy names
              </Button>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-border/70 bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="h-10 text-xs">Lead</TableHead>
                    <TableHead className="h-10 text-xs">Associate</TableHead>
                    <TableHead className="h-10 text-xs">Center</TableHead>
                    <TableHead className="h-10 text-xs">Stage</TableHead>
                    <TableHead className="h-10 text-xs">Status</TableHead>
                    <TableHead className="h-10 text-xs">Source</TableHead>
                    <TableHead className="h-10 text-xs">Created</TableHead>
                    <TableHead className="h-10 text-xs">Follow Ups</TableHead>
                    <TableHead className="h-10 text-right text-xs">LTV</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modalLeadRows.map((lead) => (
                    <TableRow key={lead.id} className="align-top">
                      <TableCell className="min-w-40 p-3 text-xs font-semibold text-foreground">{normalizePersonName(lead.fullName) || lead.fullName || '-'}</TableCell>
                      <TableCell className="p-3 text-xs text-muted-foreground">{cleanLooseText(lead.associate) || '-'}</TableCell>
                      <TableCell className="min-w-36 p-3 text-xs text-muted-foreground">{cleanLooseText(lead.center) || '-'}</TableCell>
                      <TableCell className="min-w-36 p-3 text-xs text-foreground">{cleanLooseText(lead.stageName) || '-'}</TableCell>
                      <TableCell className="p-3 text-xs text-muted-foreground">{cleanLooseText(lead.status) || '-'}</TableCell>
                      <TableCell className="min-w-36 p-3 text-xs text-muted-foreground">{cleanLooseText(lead.sourceName) || 'Unknown Source'}</TableCell>
                      <TableCell className="p-3 text-xs text-muted-foreground">{formatDate(lead.createdAt)}</TableCell>
                      <TableCell className="p-3 text-xs font-semibold text-foreground">{getFollowUpCompletion(lead)}</TableCell>
                      <TableCell className="p-3 text-right text-xs font-semibold text-foreground">{formatCurrency(Number(lead.ltv) || 0)}</TableCell>
                    </TableRow>
                  ))}
                  {modalLeadRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="p-6 text-center text-sm text-muted-foreground">No leads found for this selection.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
