import { useMemo, useState } from 'react';
import { BarChart3, GitCompareArrows, Gauge, Goal, TrendingUp, Users } from 'lucide-react';
import type { GroupableLeadKey, Lead } from '@/types/leads';
import { GROUPABLE_COLUMNS, getLeadFieldValue, isSalesConvertedLead } from '@/lib/lead-utils';
import { MultiSelectDropdown } from './MultiSelectDropdown';
import { isOverdue } from '@/hooks/useLeadsData';

interface Props {
  leads: Lead[];
}

const comparisonGroupKeys = GROUPABLE_COLUMNS.filter(({ key }) => ['stageName', 'status', 'sourceName', 'center', 'channel', 'conversionStatus', 'trialStatus'].includes(key));

interface AssociateComparisonStat {
  associate: string;
  total: number;
  converted: number;
  active: number;
  lost: number;
  trials: number;
  trialScheduled: number;
  membershipsSold: number;
  overdue: number;
  avgLtv: number;
  totalLtv: number;
  avgVisits: number;
  avgFollowUps: number;
  conversionRate: number;
  closeRate: number;
  distribution: Map<string, number>;
}

export function LeadComparison({ leads }: Props) {
  const associates = useMemo(
    () => Array.from(new Set(leads.map((lead) => lead.associate).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [leads],
  );
  const [selectedAssociates, setSelectedAssociates] = useState<string[]>([]);
  const [groupKey, setGroupKey] = useState<GroupableLeadKey>('stageName');

  const effectiveAssociates = selectedAssociates.length > 0 ? selectedAssociates : associates.slice(0, Math.min(4, associates.length));

  const associateStats = useMemo<AssociateComparisonStat[]>(() => {
    return effectiveAssociates.map((associate) => {
      const items = leads.filter((lead) => lead.associate === associate);
      const groups = new Map<string, number>();
      const converted = items.filter(isSalesConvertedLead).length;
      const lost = items.filter(isLostLead).length;
      const trials = items.filter(isTrialLead).length;
      const membershipsSold = converted;

      for (const lead of items) {
        const value = getLeadFieldValue(lead, groupKey) || '—';
        groups.set(value, (groups.get(value) ?? 0) + 1);
      }

      return {
        associate,
        total: items.length,
        converted,
        active: Math.max(items.length - lost - converted, 0),
        trials,
        trialScheduled: items.filter((lead) => /trial scheduled/i.test(lead.stageName)).length,
        membershipsSold,
        lost,
        overdue: items.filter((lead) => lead.followUps.some((followUp) => isOverdue(followUp.date, lead.status))).length,
        avgLtv: items.length > 0 ? items.reduce((sum, lead) => sum + lead.ltv, 0) / items.length : 0,
        totalLtv: items.reduce((sum, lead) => sum + lead.ltv, 0),
        avgVisits: items.length > 0 ? items.reduce((sum, lead) => sum + lead.visits, 0) / items.length : 0,
        avgFollowUps: items.length > 0
          ? items.reduce((sum, lead) => sum + lead.followUps.filter((followUp) => followUp.date && followUp.date !== '-').length, 0) / items.length
          : 0,
        conversionRate: items.length > 0 ? (converted / items.length) * 100 : 0,
        closeRate: trials > 0 ? (membershipsSold / trials) * 100 : 0,
        distribution: groups,
      };
    });
  }, [effectiveAssociates, groupKey, leads]);

  const distributionKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const stat of associateStats) {
      for (const key of stat.distribution.keys()) {
        keys.add(key);
      }
    }
    return Array.from(keys).sort((a, b) => a.localeCompare(b));
  }, [associateStats]);

  const metricRows: Array<{ label: string; getter: (stat: AssociateComparisonStat) => string }> = [
    { label: 'Total Leads', getter: (stat) => String(stat.total) },
    { label: 'Active Leads', getter: (stat) => String(stat.active) },
    { label: 'Converted / Sold', getter: (stat) => String(stat.converted) },
    { label: 'Lost / Not Interested', getter: (stat) => String(stat.lost) },
    { label: 'Trials', getter: (stat) => String(stat.trials) },
    { label: 'Trial Scheduled', getter: (stat) => String(stat.trialScheduled) },
    { label: 'Membership Sold', getter: (stat) => String(stat.membershipsSold) },
    { label: 'Overdue Follow-up Leads', getter: (stat) => String(stat.overdue) },
    { label: 'Conversion Rate', getter: (stat) => `${stat.conversionRate.toFixed(1)}%` },
    { label: 'Trial Close Rate', getter: (stat) => `${stat.closeRate.toFixed(1)}%` },
    { label: 'Avg Visits', getter: (stat) => stat.avgVisits.toFixed(1) },
    { label: 'Avg Follow-ups', getter: (stat) => stat.avgFollowUps.toFixed(1) },
    { label: 'Avg LTV', getter: (stat) => `₹${stat.avgLtv.toFixed(0)}` },
    { label: 'Total LTV', getter: (stat) => `₹${stat.totalLtv.toLocaleString()}` },
  ];

  const topPerformer = useMemo(() => [...associateStats].sort((a, b) => b.conversionRate - a.conversionRate)[0], [associateStats]);
  const bestCloser = useMemo(() => [...associateStats].sort((a, b) => b.closeRate - a.closeRate)[0], [associateStats]);
  const revenueLeader = useMemo(() => [...associateStats].sort((a, b) => b.totalLtv - a.totalLtv)[0], [associateStats]);

  return (
    <div className="space-y-5">
      <div className="glass-strong rounded-2xl shadow-elevated overflow-hidden">
        <div className="dashboard-header-panel border-b border-white/10 px-5 py-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <GitCompareArrows className="h-4 w-4 text-sky-200" />
              Associate comparison
            </h3>
            <p className="text-xs text-slate-300 mt-1">A more detailed side-by-side view of pipeline quality, trial movement, follow-up pressure, and revenue outcomes.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[280px,220px]">
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-300">Associates</label>
              <MultiSelectDropdown
                label="Associates"
                options={associates}
                selected={selectedAssociates}
                onChange={setSelectedAssociates}
                allLabel="Default top set"
                buttonClassName="h-10 w-full justify-between rounded-xl border-white/20 bg-white/10 px-3 text-sm font-normal text-white hover:bg-white/15"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-300">Compare by</label>
              <select
                value={groupKey}
                onChange={(event) => setGroupKey(event.target.value as GroupableLeadKey)}
                className="h-10 rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white"
              >
                {comparisonGroupKeys.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          <InsightCard icon={Users} label="Associates in view" value={associateStats.length} note={`${leads.length} filtered leads`} />
          <InsightCard icon={TrendingUp} label="Best conversion rate" value={topPerformer ? `${topPerformer.conversionRate.toFixed(1)}%` : '—'} note={topPerformer?.associate ?? 'No data'} />
          <InsightCard icon={Goal} label="Best trial close rate" value={bestCloser ? `${bestCloser.closeRate.toFixed(1)}%` : '—'} note={bestCloser?.associate ?? 'No data'} />
          <InsightCard icon={Gauge} label="Revenue leader" value={revenueLeader ? `₹${revenueLeader.totalLtv.toLocaleString()}` : '—'} note={revenueLeader?.associate ?? 'No data'} />
        </div>

        <div className="grid gap-4 px-5 pb-5 xl:grid-cols-2">
          {associateStats.map((stat) => (
            <div key={stat.associate} className="rounded-2xl border border-border/40 bg-background/70 p-4 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{stat.associate}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.total} filtered leads</p>
                </div>
                <div className="h-10 w-10 rounded-xl semantic-info border flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-sky-700 dark:text-sky-300" />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <Metric label="Total" value={stat.total} />
                <Metric label="Active" value={stat.active} tone="blue" />
                <Metric label="Sold" value={stat.converted} tone="green" />
                <Metric label="Lost" value={stat.lost} tone="red" />
                <Metric label="Trials" value={stat.trials} tone="blue" />
                <Metric label="Trial Scheduled" value={stat.trialScheduled} tone="blue" />
                <Metric label="Membership Sold" value={stat.membershipsSold} tone="green" />
                <Metric label="Overdue" value={stat.overdue} tone={stat.overdue > 0 ? 'red' : 'default'} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <DetailRow label="Conversion rate" value={`${stat.conversionRate.toFixed(1)}%`} />
                <DetailRow label="Trial close rate" value={`${stat.closeRate.toFixed(1)}%`} />
                <DetailRow label="Avg LTV" value={`₹${stat.avgLtv.toFixed(0)}`} />
                <DetailRow label="Total LTV" value={`₹${stat.totalLtv.toLocaleString()}`} />
                <DetailRow label="Avg visits" value={stat.avgVisits.toFixed(1)} />
                <DetailRow label="Avg follow-ups" value={stat.avgFollowUps.toFixed(1)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-strong rounded-2xl shadow-elevated overflow-hidden">
        <div className="border-b border-border/30 px-5 py-4">
          <h4 className="text-sm font-semibold text-foreground">Metric comparison matrix</h4>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="dashboard-header-panel">
              <tr>
                <th className="h-11 px-5 text-left text-[10px] uppercase tracking-wider text-slate-200">Metric</th>
                {associateStats.map((stat) => (
                  <th key={stat.associate} className="h-11 px-5 text-left text-[10px] uppercase tracking-wider text-slate-200">{stat.associate}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricRows.map(({ label, getter }) => (
                <tr key={label} className="border-t border-border/20">
                  <td className="px-5 py-3 text-sm font-medium text-foreground">{label}</td>
                  {associateStats.map((stat) => (
                    <td key={`${stat.associate}-${label}`} className="px-5 py-3 text-sm text-muted-foreground">{getter(stat)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-strong rounded-2xl shadow-elevated overflow-hidden">
        <div className="border-b border-border/30 px-5 py-4">
          <h4 className="text-sm font-semibold text-foreground">Distribution by {comparisonGroupKeys.find((option) => option.key === groupKey)?.label ?? groupKey}</h4>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="dashboard-header-panel">
              <tr>
                <th className="h-11 px-5 text-left text-[10px] uppercase tracking-wider text-slate-200">Group</th>
                {associateStats.map((stat) => (
                  <th key={stat.associate} className="h-11 px-5 text-left text-[10px] uppercase tracking-wider text-slate-200">{stat.associate}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {distributionKeys.map((groupLabel) => (
                <tr key={groupLabel} className="border-t border-border/20">
                  <td className="px-5 py-3 text-sm font-medium text-foreground">{groupLabel}</td>
                  {associateStats.map((stat) => {
                    const count = stat.distribution.get(groupLabel) ?? 0;
                    const pct = stat.total > 0 ? (count / stat.total) * 100 : 0;

                    return (
                      <td key={`${stat.associate}-${groupLabel}`} className="px-5 py-3 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between gap-3">
                          <span>{count}</span>
                          <span className="text-[11px] text-muted-foreground/80">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-border/50">
                          <div className="h-full rounded-full bg-[hsl(var(--semantic-info))]" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function isLostLead(lead: Lead): boolean {
  return /lost|not interested|dead|dropped|cancel/i.test(`${lead.status} ${lead.stageName}`);
}

function isTrialLead(lead: Lead): boolean {
  return /trial/i.test(`${lead.stageName} ${lead.trialStatus} ${lead.status}`);
}

function InsightCard({ icon: Icon, label, value, note }: { icon: typeof Users; label: string; value: number | string; note: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-background/70 p-4 shadow-card">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="h-8 w-8 rounded-xl semantic-info border flex items-center justify-center">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold font-mono text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function Metric({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'green' | 'blue' | 'red' }) {
  const toneClass = {
    default: 'bg-background border-border/40 text-foreground',
    green: 'semantic-success',
    blue: 'semantic-info',
    red: 'semantic-warning',
  }[tone];

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/30 bg-background/50 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
