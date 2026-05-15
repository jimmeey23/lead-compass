import { Fragment, useMemo, useState } from 'react';
import { BarChart3, ChevronDown, ChevronRight, IndianRupee, Layers3, Search, Sigma } from 'lucide-react';
import type { GroupableLeadKey, Lead } from '@/types/leads';
import { GROUPABLE_COLUMNS, cleanLooseText, getLeadFieldValue, isSalesConvertedLead, parseFlexibleDate } from '@/lib/lead-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type PeriodType = 'days' | 'week' | 'fortnight' | 'month' | 'quarter' | 'sixMonths' | 'year';
type MetricKey = 'leads' | 'converted' | 'revenue' | 'avgRevenue' | 'visits' | 'purchases' | 'conversionRate';

interface Props {
  leads: Lead[];
}

const PERIOD_OPTIONS: Array<{ key: PeriodType; label: string }> = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'days', label: 'Day' },
  { key: 'fortnight', label: 'Fortnight' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'sixMonths', label: '6 months' },
  { key: 'year', label: 'Year' },
];

const METRIC_OPTIONS: Array<{ key: MetricKey; label: string }> = [
  { key: 'leads', label: 'Leads' },
  { key: 'converted', label: 'Converted' },
  { key: 'conversionRate', label: 'Conversion %' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'avgRevenue', label: 'Avg revenue' },
  { key: 'visits', label: 'Visits' },
  { key: 'purchases', label: 'Purchases' },
];

const DIMENSION_KEYS = GROUPABLE_COLUMNS.filter(({ key }) => ['stageName', 'sourceName', 'center', 'classType', 'associate', 'channel', 'status', 'trialStatus', 'conversionStatus'].includes(key));

interface PeriodBucket {
  key: string;
  label: string;
  start: number;
}

interface CellStats {
  leads: Lead[];
  leadsCount: number;
  converted: number;
  revenue: number;
  visits: number;
  purchases: number;
}

interface PeriodRow {
  label: string;
  subtotalLabel?: string;
  cells: Map<string, CellStats>;
  total: CellStats;
}

function emptyStats(): CellStats {
  return { leads: [], leadsCount: 0, converted: 0, revenue: 0, visits: 0, purchases: 0 };
}

function addLead(stats: CellStats, lead: Lead) {
  stats.leads.push(lead);
  stats.leadsCount += 1;
  if (isSalesConvertedLead(lead)) stats.converted += 1;
  stats.revenue += Number(lead.ltv) || 0;
  stats.visits += Number(lead.visits) || 0;
  stats.purchases += Number(lead.purchasesMade) || 0;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).format(date);
}

function getPeriodBucket(date: Date, periodType: PeriodType): PeriodBucket {
  const year = date.getFullYear();
  const month = date.getMonth();

  if (periodType === 'days') {
    const start = new Date(year, month, date.getDate());
    return { key: start.toISOString().slice(0, 10), label: formatShortDate(start), start: start.getTime() };
  }

  if (periodType === 'week') {
    const start = startOfWeek(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { key: `W-${start.toISOString().slice(0, 10)}`, label: `${formatShortDate(start)} - ${formatShortDate(end)}`, start: start.getTime() };
  }

  if (periodType === 'fortnight') {
    const half = date.getDate() <= 15 ? 1 : 2;
    const start = new Date(year, month, half === 1 ? 1 : 16);
    return { key: `${year}-${month + 1}-F${half}`, label: `${new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(date)} F${half}`, start: start.getTime() };
  }

  if (periodType === 'month') {
    const start = new Date(year, month, 1);
    return { key: `${year}-${month + 1}`, label: new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(date), start: start.getTime() };
  }

  if (periodType === 'quarter') {
    const quarter = Math.floor(month / 3) + 1;
    const start = new Date(year, (quarter - 1) * 3, 1);
    return { key: `${year}-Q${quarter}`, label: `Q${quarter} ${year}`, start: start.getTime() };
  }

  if (periodType === 'sixMonths') {
    const half = month < 6 ? 1 : 2;
    const start = new Date(year, half === 1 ? 0 : 6, 1);
    return { key: `${year}-H${half}`, label: `H${half} ${year}`, start: start.getTime() };
  }

  const start = new Date(year, 0, 1);
  return { key: `${year}`, label: String(year), start: start.getTime() };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(value);
}

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(1)}`;
}

function getMetricValue(stats: CellStats, metric: MetricKey): number {
  if (metric === 'leads') return stats.leadsCount;
  if (metric === 'converted') return stats.converted;
  if (metric === 'revenue') return stats.revenue;
  if (metric === 'avgRevenue') return stats.leadsCount > 0 ? stats.revenue / stats.leadsCount : 0;
  if (metric === 'visits') return stats.visits;
  if (metric === 'purchases') return stats.purchases;
  return stats.leadsCount > 0 ? (stats.converted / stats.leadsCount) * 100 : 0;
}

function formatMetricValue(value: number, metric: MetricKey): string {
  if (metric === 'revenue' || metric === 'avgRevenue') return formatCurrency(value);
  if (metric === 'conversionRate') return `${value.toFixed(1)}%`;
  return formatNumber(value);
}

export function PeriodicAnalytics({ leads }: Props) {
  const [periodType, setPeriodType] = useState<PeriodType>('week');
  const [dimensionKey, setDimensionKey] = useState<GroupableLeadKey>('stageName');
  const [metric, setMetric] = useState<MetricKey>('leads');
  const [search, setSearch] = useState('');
  const [expandedSubtotals, setExpandedSubtotals] = useState<string[]>([]);
  const [drilldown, setDrilldown] = useState<{ title: string; leads: Lead[] } | null>(null);

  const { buckets, rows, subtotals, totalRow } = useMemo(() => {
    const bucketMap = new Map<string, PeriodBucket>();
    const rowMap = new Map<string, PeriodRow>();
    const subtotalMap = new Map<string, PeriodRow>();
    const total: PeriodRow = { label: 'Total', cells: new Map(), total: emptyStats() };

    for (const lead of leads) {
      const date = parseFlexibleDate(lead.createdAt);
      if (!date) continue;

      const bucket = getPeriodBucket(date, periodType);
      bucketMap.set(bucket.key, bucket);

      const label = getLeadFieldValue(lead, dimensionKey) || 'Unassigned';
      const subtotalLabel = dimensionKey === 'stageName' ? getStageSubtotal(label) : label.charAt(0).toUpperCase();
      const row = rowMap.get(label) ?? { label, subtotalLabel, cells: new Map(), total: emptyStats() };
      const cell = row.cells.get(bucket.key) ?? emptyStats();
      addLead(cell, lead);
      addLead(row.total, lead);
      row.cells.set(bucket.key, cell);
      rowMap.set(label, row);

      const subtotal = subtotalMap.get(subtotalLabel) ?? { label: subtotalLabel, cells: new Map(), total: emptyStats() };
      const subtotalCell = subtotal.cells.get(bucket.key) ?? emptyStats();
      addLead(subtotalCell, lead);
      addLead(subtotal.total, lead);
      subtotal.cells.set(bucket.key, subtotalCell);
      subtotalMap.set(subtotalLabel, subtotal);

      const totalCell = total.cells.get(bucket.key) ?? emptyStats();
      addLead(totalCell, lead);
      addLead(total.total, lead);
      total.cells.set(bucket.key, totalCell);
    }

    const sortedBuckets = Array.from(bucketMap.values()).sort((a, b) => b.start - a.start).slice(0, 16);
    const sortedRows = Array.from(rowMap.values())
      .filter((row) => !search || row.label.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => getMetricValue(b.total, metric) - getMetricValue(a.total, metric) || a.label.localeCompare(b.label));
    const sortedSubtotals = Array.from(subtotalMap.values()).sort((a, b) => getMetricValue(b.total, metric) - getMetricValue(a.total, metric) || a.label.localeCompare(b.label));

    return { buckets: sortedBuckets, rows: sortedRows, subtotals: sortedSubtotals, totalRow: total };
  }, [dimensionKey, leads, metric, periodType, search]);

  const metricLabel = METRIC_OPTIONS.find((option) => option.key === metric)?.label ?? 'Metric';

  return (
    <div className="space-y-5">
      <section className="premium-panel overflow-hidden rounded-[28px]">
        <div className="border-b border-blue-200 bg-[linear-gradient(135deg,#1d4ed8,#2563eb,#06b6d4)] px-5 py-4 text-white">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <BarChart3 className="h-4 w-4 text-sky-300" />
                Periodic analytics
              </h2>
              <p className="mt-1 text-xs text-blue-100">Dynamic periods as columns with grouped metric rows, subtotals, totals, and drill-down data.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[180px,190px,180px,220px]">
              <SelectControl label="Period" value={periodType} onChange={(value) => setPeriodType(value as PeriodType)} options={PERIOD_OPTIONS.map((option) => ({ label: option.label, value: option.key }))} />
              <SelectControl label="Dimension" value={dimensionKey} onChange={(value) => setDimensionKey(value as GroupableLeadKey)} options={DIMENSION_KEYS.map((option) => ({ label: option.label, value: option.key }))} />
              <SelectControl label="Metric" value={metric} onChange={(value) => setMetric(value as MetricKey)} options={METRIC_OPTIONS.map((option) => ({ label: option.label, value: option.key }))} />
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-100">Find row</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-600" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search dimension" className="h-10 rounded-xl border-white bg-white pl-9 text-sm font-semibold text-slate-900 shadow-sm placeholder:text-slate-400" />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {METRIC_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => setMetric(option.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${metric === option.key ? 'bg-white text-blue-700 shadow-sm' : 'border border-white/30 bg-white/10 text-white hover:bg-white/20'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 border-b border-border bg-muted/55 p-4 md:grid-cols-4">
          <KpiCard icon={Sigma} label="Filtered leads" value={formatNumber(totalRow.total.leadsCount)} />
          <KpiCard icon={Layers3} label="Rows" value={formatNumber(rows.length)} />
          <KpiCard icon={IndianRupee} label="Revenue" value={formatCurrency(totalRow.total.revenue)} />
          <KpiCard icon={BarChart3} label={metricLabel} value={formatMetricValue(getMetricValue(totalRow.total, metric), metric)} />
        </div>

        <div className="overflow-auto lead-scroll-area">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr>
                <th className="sticky left-0 z-20 min-w-[280px] border-b border-r border-border bg-card px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {DIMENSION_KEYS.find((option) => option.key === dimensionKey)?.label}
                </th>
                <th className="min-w-[116px] border-b border-border px-3 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total</th>
                {buckets.map((bucket) => (
                  <th key={bucket.key} className="min-w-[132px] border-b border-border px-3 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{bucket.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <PeriodicRow row={totalRow} buckets={buckets} metric={metric} isTotal onDrilldown={setDrilldown} />
              {subtotals.map((subtotal) => {
                const expanded = expandedSubtotals.includes(subtotal.label);
                const childRows = rows.filter((row) => row.subtotalLabel === subtotal.label);
                return (
                  <Fragment key={`group-${subtotal.label}`}>
                    <PeriodicRow
                      key={`subtotal-${subtotal.label}`}
                      row={subtotal}
                      buckets={buckets}
                      metric={metric}
                      isSubtotal
                      expanded={expanded}
                      childCount={childRows.length}
                      onToggle={() => setExpandedSubtotals((current) => current.includes(subtotal.label) ? current.filter((item) => item !== subtotal.label) : [...current, subtotal.label])}
                      onDrilldown={setDrilldown}
                    />
                    {expanded && childRows.map((row) => (
                      <PeriodicRow key={row.label} row={row} buckets={buckets} metric={metric} onDrilldown={setDrilldown} />
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={Boolean(drilldown)} onOpenChange={(open) => { if (!open) setDrilldown(null); }}>
        <DialogContent className="max-h-[82vh] max-w-5xl overflow-hidden rounded-3xl p-0">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle>{drilldown?.title}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[66vh] overflow-auto lead-scroll-area">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  {['Lead', 'Created', 'Converted', 'Stage', 'Source', 'Center', 'Associate', 'Revenue'].map((label) => (
                    <th key={label} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(drilldown?.leads ?? []).map((lead) => (
                  <tr key={lead.id} className="border-t border-border">
                    <td className="px-4 py-2 font-semibold text-foreground">{lead.fullName}</td>
                    <td className="px-4 py-2 font-mono-data text-xs text-muted-foreground">{lead.createdAt || '-'}</td>
                    <td className="px-4 py-2 font-mono-data text-xs text-muted-foreground">{lead.convertedAt || '-'}</td>
                    <td className="px-4 py-2 text-foreground/80">{lead.stageName || '-'}</td>
                    <td className="px-4 py-2 text-foreground/80">{lead.sourceName || '-'}</td>
                    <td className="px-4 py-2 text-foreground/80">{lead.center || '-'}</td>
                    <td className="px-4 py-2 text-foreground/80">{lead.associate || '-'}</td>
                    <td className="px-4 py-2 text-right font-mono-data text-foreground">{formatCurrency(lead.ltv || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getStageSubtotal(label: string): string {
  if (/membership sold|converted|sold/i.test(label)) return 'Converted / Sold';
  if (/trial/i.test(label)) return 'Trials';
  if (/not interested|lost|dropped|dead|cancel/i.test(label)) return 'Lost / Not Interested';
  if (/no response|did not answer|unresponsive/i.test(label)) return 'No Response';
  return 'Other Stages';
}

function SelectControl({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }> }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-100">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-xl border border-white bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-4 w-4 text-foreground" />
        {label}
      </div>
      <p className="font-mono-data text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function PeriodicRow({ row, buckets, metric, isTotal, isSubtotal, expanded, childCount, onToggle, onDrilldown }: {
  row: PeriodRow;
  buckets: PeriodBucket[];
  metric: MetricKey;
  isTotal?: boolean;
  isSubtotal?: boolean;
  expanded?: boolean;
  childCount?: number;
  onToggle?: () => void;
  onDrilldown: (drilldown: { title: string; leads: Lead[] }) => void;
}) {
  const labelClass = isTotal ? 'font-bold text-white' : isSubtotal ? 'font-bold text-foreground' : 'pl-8 font-medium text-foreground/80';
  const bgClass = isTotal ? 'bg-blue-700 text-white dark:bg-blue-950' : isSubtotal ? 'bg-primary/10' : 'bg-card';
  const totalValue = formatMetricValue(getMetricValue(row.total, metric), metric);

  return (
    <tr className={`${bgClass} border-t border-slate-200`}>
      <td className={`sticky left-0 z-10 border-r border-border px-4 py-3 ${bgClass}`}>
        <button type="button" onClick={isSubtotal ? onToggle : undefined} className={`flex w-full items-center gap-2 text-left text-sm ${labelClass}`}>
          {isSubtotal ? (expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
          <span className="truncate">{row.label}</span>
          {isSubtotal && <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">{childCount}</span>}
        </button>
      </td>
      <MetricCell value={totalValue} stats={row.total} title={`${row.label} · Total`} onDrilldown={onDrilldown} strong={isTotal || isSubtotal} dark={isTotal} />
      {buckets.map((bucket) => {
        const stats = row.cells.get(bucket.key) ?? emptyStats();
        return <MetricCell key={bucket.key} value={formatMetricValue(getMetricValue(stats, metric), metric)} stats={stats} title={`${row.label} · ${bucket.label}`} onDrilldown={onDrilldown} dark={isTotal} />;
      })}
    </tr>
  );
}

function MetricCell({ value, stats, title, onDrilldown, strong, dark }: { value: string; stats: CellStats; title: string; onDrilldown: (drilldown: { title: string; leads: Lead[] }) => void; strong?: boolean; dark?: boolean }) {
  return (
    <td className="border-b border-border/70 px-3 py-3 text-right">
      <button
        type="button"
        disabled={stats.leadsCount === 0}
        onClick={() => onDrilldown({ title, leads: stats.leads })}
        className={`rounded-lg px-2 py-1 font-mono-data text-sm ${strong ? 'font-bold' : 'font-semibold'} ${dark ? 'text-white hover:bg-white/10' : stats.leadsCount > 0 ? 'text-foreground hover:bg-primary/10' : 'text-muted-foreground/50'}`}
      >
        {value}
      </button>
    </td>
  );
}
