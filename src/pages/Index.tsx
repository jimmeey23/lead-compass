import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useLeadsData } from '@/hooks/useLeadsData';
import { useLeadAudit } from '@/hooks/useLeadAudit';
import { LeadTable } from '@/components/LeadTable';
import { LeadFilters } from '@/components/LeadFilters';
import { AssociateOverview } from '@/components/AssociateOverview';
import { LeadBoard } from '@/components/LeadBoard';
import { LeadComparison } from '@/components/LeadComparison';
import { JourneyFlow } from '@/components/JourneyFlow';
import { PeriodicAnalytics } from '@/components/PeriodicAnalytics';
import { defaultFilters } from '@/types/leads';
import type { FilterState, ViewMode, Lead } from '@/types/leads';
import { RefreshCw, LayoutList, Users, Loader2, Zap, Rows3, GitCompareArrows, Building2, Workflow, Lock, CalendarRange, Moon, Sun, Route, BrainCircuit, AlertTriangle, ClipboardList, CheckCircle2, Copy, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildLeadAuditPayload } from '@/lib/lead-audit';
import { applyLeadFilters, buildLeadOptions, buildLeadPerformanceSummary, getCurrentWeekRangeLabel, getDateNeutralFilters } from '@/lib/lead-utils';

const COMPARISON_SECRET = '9818';
const COMPARISON_UNLOCK_STORAGE_KEY = 'lead-compass:comparison-unlocked';

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="h-9 shrink-0 gap-1.5 rounded-xl border-border/70 bg-card/90 px-3 text-xs font-semibold text-foreground shadow-sm backdrop-blur-xl hover:border-primary/40 hover:bg-primary/10"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-3.5 w-3.5 text-rose-200" /> : <Moon className="h-3.5 w-3.5 text-rose-900" />}
      <span className="hidden md:inline">{isDark ? 'Light' : 'Dark'}</span>
    </Button>
  );
}

function HeaderMetric({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'success' }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/85 px-3 py-1.5 shadow-sm">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-mono-data text-sm font-bold ${tone === 'success' ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}

function AuditMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/80 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono-data text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function AuditLocalPreview({ payload }: { payload: ReturnType<typeof buildLeadAuditPayload> }) {
  const topIssues = payload.deterministicIssues.slice(0, 8);

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Local pre-audit found {payload.summary.deterministicIssueCount} possible issues before DeepSeek review.
      </p>
      {topIssues.map((issue, index) => (
        <AuditIssueCard key={`${issue.leadId}-${issue.category}-${index}`} issue={issue} />
      ))}
    </div>
  );
}

const auditSectionMeta: Record<string, { label: string; tone: string }> = {
  urgentIssues: { label: 'Urgent issues', tone: 'border-rose-200 bg-rose-50/80 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/25 dark:text-rose-100' },
  followUpTimingIssues: { label: 'Follow-up timing', tone: 'border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100' },
  stageDiscrepancies: { label: 'Stage discrepancies', tone: 'border-sky-200 bg-sky-50/80 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/25 dark:text-sky-100' },
  copyPasteSignals: { label: 'Copy-paste signals', tone: 'border-violet-200 bg-violet-50/80 text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/25 dark:text-violet-100' },
};

type AuditIssueRow = {
  category: string;
  leadLabel: string;
  severity: string;
  reason: string;
  evidence: string;
  recommendedAction: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function formatAuditLabel(value: string): string {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}

function auditText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(auditText).filter(Boolean).join(', ');
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return ['reason', 'summary', 'detail', 'message', 'recommendedAction']
      .map((key) => auditText(record[key]))
      .find(Boolean) ?? '';
  }
  return '';
}

function getAuditIssueRows(data: Record<string, unknown>, sections: string[], leadLabels = new Map<string, string>()): AuditIssueRow[] {
  return sections.flatMap((section) => {
    const value = data[section];
    if (!Array.isArray(value)) return [];

    return value.slice(0, 12).map((item): AuditIssueRow => {
      const record = asRecord(item);
      const leadId = auditText(record?.leadId);
      return {
        category: auditSectionMeta[section]?.label ?? formatAuditLabel(section),
        leadLabel: auditText(record?.leadName) || auditText(record?.lead) || auditText(record?.name) || leadLabels.get(leadId) || leadId || 'Multiple',
        severity: auditText(record?.severity) || 'Review',
        reason: auditText(record?.reason) || auditText(record?.detail) || auditText(item),
        evidence: auditText(record?.evidence),
        recommendedAction: auditText(record?.recommendedAction),
      };
    });
  }).filter((row) => row.reason || row.evidence || row.recommendedAction);
}

function severityBadgeVariant(severity: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  return severity.toLowerCase().includes('high') || severity.toLowerCase().includes('urgent') ? 'destructive' : 'secondary';
}

function copyAuditText(label: string, text: string) {
  if (!text.trim()) return;
  navigator.clipboard?.writeText(text)
    .then(() => toast.success(`${label} copied`))
    .catch(() => toast.error('Unable to copy', { description: 'Clipboard access is unavailable in this browser.' }));
}

export function parseAuditResult(result: unknown, depth = 0): unknown {
  if (depth > 6) return result;

  if (typeof result === 'object' && result !== null) {
    const record = result as Record<string, unknown>;
    if ('analysis' in record && record.analysis !== undefined) {
      return parseAuditResult(record.analysis, depth + 1);
    }
    return result;
  }

  if (typeof result !== 'string') return result;

  const trimmed = result.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const unfencedCandidate = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const jsonCandidate = fencedMatch?.[1]?.trim() ?? unfencedCandidate;

  if (!jsonCandidate.startsWith('{') && !jsonCandidate.startsWith('[') && !jsonCandidate.startsWith('"')) return result;

  try {
    return parseAuditResult(JSON.parse(jsonCandidate), depth + 1);
  } catch {
    return result;
  }
}

function AuditResultView({ result, payload }: { result: unknown; payload?: ReturnType<typeof buildLeadAuditPayload> | null }) {
  const parsedResult = parseAuditResult(result);

  if (typeof parsedResult === 'object' && parsedResult !== null && 'error' in parsedResult) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground">
        {String((parsedResult as { error: unknown }).error)}
      </div>
    );
  }

  if (typeof parsedResult !== 'object' || parsedResult === null) {
    return (
      <div className="rounded-2xl border border-border bg-card/80 p-4 text-sm leading-relaxed text-foreground">
        {String(parsedResult)}
      </div>
    );
  }

  const data = parsedResult as Record<string, unknown>;
  const issueSections = ['urgentIssues', 'followUpTimingIssues', 'stageDiscrepancies', 'copyPasteSignals'];
  const leadLabels = new Map<string, string>();
  payload?.records.forEach((record) => {
    leadLabels.set(record.id, record.name);
    leadLabels.set(record.leadId, record.leadName);
  });
  payload?.deterministicIssues.forEach((issue) => leadLabels.set(issue.leadId, issue.leadName));
  const issueRows = getAuditIssueRows(data, issueSections, leadLabels);
  const recommendedActions = Array.isArray(data.recommendedActions) ? data.recommendedActions : [];
  const summaryText = auditText(data.executiveSummary);
  const reportText = [
    summaryText,
    ...issueRows.map((row) => `${row.category} | ${row.leadLabel} | ${row.severity}: ${row.reason} Evidence: ${row.evidence} Action: ${row.recommendedAction}`),
    ...recommendedActions.map((action) => `Action: ${auditText(action)}`),
  ].filter(Boolean).join('\n');

  return (
    <div className="space-y-5">
      {typeof data.executiveSummary === 'string' && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <BrainCircuit className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Executive summary</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{data.executiveSummary}</p>
            </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl text-xs" onClick={() => copyAuditText('Summary', summaryText)}>
                <Copy className="h-3.5 w-3.5" /> Copy summary
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl text-xs" onClick={() => copyAuditText('Report', reportText)}>
                <ClipboardList className="h-3.5 w-3.5" /> Copy report
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        {issueSections.map((section) => {
          const count = Array.isArray(data[section]) ? data[section].length : 0;
          const meta = auditSectionMeta[section];
          return (
            <div key={section} className={`rounded-2xl border p-3 ${meta.tone}`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-75">{meta.label}</p>
              <p className="mt-1 font-mono-data text-2xl font-bold">{count}</p>
            </div>
          );
        })}
      </div>

      {issueRows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card/80">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Analysis table</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="h-10 text-xs">Category</TableHead>
                <TableHead className="h-10 text-xs">Lead</TableHead>
                <TableHead className="h-10 text-xs">Severity</TableHead>
                <TableHead className="h-10 text-xs">Finding</TableHead>
                <TableHead className="h-10 text-xs">Evidence</TableHead>
                <TableHead className="h-10 text-xs">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issueRows.map((row, index) => (
                <TableRow key={`${row.category}-${row.leadLabel}-${index}`} className="align-top">
                  <TableCell className="min-w-32 p-3 text-xs font-semibold text-foreground">{row.category}</TableCell>
                  <TableCell className="p-3 text-xs font-semibold text-foreground">{row.leadLabel}</TableCell>
                  <TableCell className="p-3">
                    <Badge variant={severityBadgeVariant(row.severity)} className="text-[10px] uppercase tracking-[0.12em]">{row.severity}</Badge>
                  </TableCell>
                  <TableCell className="min-w-48 p-3 text-xs leading-relaxed text-foreground">{row.reason || '-'}</TableCell>
                  <TableCell className="min-w-48 p-3 text-xs leading-relaxed text-muted-foreground">{row.evidence || '-'}</TableCell>
                  <TableCell className="min-w-48 p-3 text-xs leading-relaxed text-foreground">{row.recommendedAction || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100">
          <CheckCircle2 className="h-5 w-5" />
          No structured issue rows were returned by the AI audit.
        </div>
      )}

      {issueSections.map((section) => (
        <AuditSection key={section} title={section} value={data[section]} leadLabels={leadLabels} />
      ))}

      {recommendedActions.length > 0 && (
        <section className="rounded-2xl border border-border bg-card/80 p-4">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-foreground">Recommended actions</h3>
          </div>
          <div className="grid gap-2">
            {recommendedActions.slice(0, 10).map((action, index) => (
              <div key={index} className="rounded-xl bg-muted/40 px-3 py-2 text-xs leading-relaxed text-foreground">
                {auditText(action) || String(action)}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AuditSection({ title, value, leadLabels = new Map<string, string>() }: { title: string; value: unknown; leadLabels?: Map<string, string> }) {
  if (!Array.isArray(value) || value.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5" />
        {auditSectionMeta[title]?.label ?? formatAuditLabel(title)}
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
      {value.slice(0, 8).map((item, index) => (
        <div key={index} className="rounded-2xl border border-border bg-card/80 p-4 text-sm shadow-sm">
          {typeof item === 'object' && item !== null ? (
            <div className="space-y-1.5">
              {('leadName' in item || 'leadId' in item) && (
                <p className="text-xs font-semibold text-foreground">
                  Lead: {String((item as Record<string, unknown>).leadName ?? leadLabels.get(String((item as Record<string, unknown>).leadId ?? '')) ?? (item as Record<string, unknown>).leadId)}
                </p>
              )}
              {'severity' in item && <Badge variant={severityBadgeVariant(String((item as Record<string, unknown>).severity))} className="text-[10px] uppercase tracking-[0.12em]">{String((item as Record<string, unknown>).severity)}</Badge>}
              {'reason' in item && <p className="font-semibold text-foreground">{String((item as Record<string, unknown>).reason)}</p>}
              {'evidence' in item && <p className="text-xs leading-relaxed text-muted-foreground">{String((item as Record<string, unknown>).evidence)}</p>}
              {'recommendedAction' in item && <p className="text-xs leading-relaxed text-foreground">{String((item as Record<string, unknown>).recommendedAction)}</p>}
            </div>
          ) : (
            <p className="text-sm text-foreground">{String(item)}</p>
          )}
        </div>
      ))}
      </div>
    </section>
  );
}

function AuditIssueCard({ issue }: { issue: ReturnType<typeof buildLeadAuditPayload>['deterministicIssues'][number] }) {
  return (
    <div className="rounded-2xl border border-border bg-card/80 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-foreground">{issue.leadName}</p>
        <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{issue.severity}</span>
      </div>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{issue.category.replace(/_/g, ' ')}</p>
      <p className="mt-1 text-sm text-foreground">{issue.detail}</p>
      <p className="mt-1 text-xs text-muted-foreground">{issue.evidence}</p>
    </div>
  );
}

const Index = () => {
  const { data: leads = [], isLoading, error, refetch, isFetching } = useLeadsData();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [view, setView] = useState<ViewMode>('table');
  const [isComparisonUnlocked, setIsComparisonUnlocked] = useState(false);
  const [isComparisonDialogOpen, setIsComparisonDialogOpen] = useState(false);
  const [comparisonCode, setComparisonCode] = useState('');
  const [isAuditDialogOpen, setIsAuditDialogOpen] = useState(false);
  const [isAssociateAuditDialogOpen, setIsAssociateAuditDialogOpen] = useState(false);
  const [selectedAssociateForAudit, setSelectedAssociateForAudit] = useState('');
  const [auditScopeLabel, setAuditScopeLabel] = useState('Filtered dashboard');
  const [auditPayload, setAuditPayload] = useState<ReturnType<typeof buildLeadAuditPayload> | null>(null);
  const [auditResult, setAuditResult] = useState<unknown>(null);
  const leadAudit = useLeadAudit();

  const filteredLeads = useMemo(() => applyLeadFilters(leads, filters), [leads, filters]);
  const periodicLeads = useMemo(() => applyLeadFilters(leads, getDateNeutralFilters(filters)), [leads, filters]);
  const performanceSummary = useMemo(() => buildLeadPerformanceSummary(filteredLeads), [filteredLeads]);
  const options = useMemo(() => buildLeadOptions(leads), [leads]);
  const weekRangeLabel = useMemo(() => getCurrentWeekRangeLabel(), []);
  const isTableWorkspace = view === 'table' || view === 'compact';
  const isWideWorkspace = isTableWorkspace || view === 'journey-flow';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsComparisonUnlocked(window.sessionStorage.getItem(COMPARISON_UNLOCK_STORAGE_KEY) === 'true');
  }, []);

  const handleViewChange = (nextView: ViewMode) => {
    if (nextView !== 'comparison') {
      setView(nextView);
      return;
    }

    if (isComparisonUnlocked) {
      setView('comparison');
      return;
    }

    setComparisonCode('');
    setIsComparisonDialogOpen(true);
  };

  const goHome = () => {
    setView('table');
    setFilters(defaultFilters);
    setIsAuditDialogOpen(false);
    setIsComparisonDialogOpen(false);
  };

  const unlockComparisonView = () => {
    if (comparisonCode.trim() !== COMPARISON_SECRET) {
      toast.error('Incorrect secret code', {
        description: 'Comparison view stays locked until the correct code is entered.',
      });
      return;
    }

    setIsComparisonUnlocked(true);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(COMPARISON_UNLOCK_STORAGE_KEY, 'true');
    }
    setIsComparisonDialogOpen(false);
    setComparisonCode('');
    setView('comparison');
    toast.success('Comparison view unlocked');
  };

  const runLeadAuditFor = async (targetLeads: Lead[], scopeLabel: string) => {
    if (targetLeads.length === 0) {
      toast.error('No leads to analyze', {
        description: 'Adjust filters so the dashboard has leads before running the audit.',
      });
      return;
    }

    const payload = buildLeadAuditPayload(targetLeads);
    setAuditPayload(payload);
    setAuditResult(null);
    setAuditScopeLabel(scopeLabel);
    setIsAssociateAuditDialogOpen(false);
    setIsAuditDialogOpen(true);

    try {
      const result = await leadAudit.mutateAsync(payload);
      setAuditResult(result.analysis ?? result);
    } catch (error) {
      const description = error instanceof Error ? error.message : 'DeepSeek analysis failed.';
      toast.error('Unable to run DeepSeek audit', { description });
      setAuditResult({ error: description });
    }
  };

  const runLeadAudit = () => runLeadAuditFor(filteredLeads, 'Filtered dashboard');

  const runAssociateAudit = () => {
    if (!selectedAssociateForAudit) {
      toast.error('Choose an associate', {
        description: 'Select one associate before generating an associate-specific report.',
      });
      return;
    }

    const associateLeads = filteredLeads.filter((lead) => lead.associate === selectedAssociateForAudit);
    void runLeadAuditFor(associateLeads, `Associate: ${selectedAssociateForAudit}`);
  };

  const views: Array<{ key: ViewMode; label: string; icon: typeof LayoutList }> = [
    { key: 'table', label: 'Detailed', icon: LayoutList },
    { key: 'compact', label: 'Compact', icon: Rows3 },
    { key: 'periodic', label: 'Periodic', icon: CalendarRange },
    { key: 'journey-flow', label: 'Journey Flow', icon: Route },
    { key: 'stage-board', label: 'Stage Board', icon: Workflow },
    { key: 'center-board', label: 'Center Board', icon: Building2 },
    { key: 'associate', label: 'Associates', icon: Users },
    { key: 'comparison', label: 'Comparison', icon: GitCompareArrows },
  ];

  return (
    <div className="app-page-bg min-h-screen text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 shadow-[0_1px_0_rgba(15,23,42,0.04),0_18px_50px_-44px_rgba(15,23,42,0.34)] backdrop-blur-2xl dark:bg-background/80 dark:shadow-[0_18px_60px_-42px_rgba(0,0,0,0.92)]">
        <div className={`${isWideWorkspace ? 'w-full px-4 md:px-6' : 'mx-auto max-w-[1680px] px-4 md:px-6'} flex min-h-16 flex-col gap-2 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between`}>
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={goHome}
                aria-label="Go to home dashboard"
                className="theme-contrast-hover flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#7f1231,#9f1d4c,#6d4bc4)] shadow-[0_16px_30px_-18px_rgba(127,18,49,0.72)] ring-1 ring-white/70 transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-primary/40 dark:ring-rose-200/20"
              >
                <Zap className="h-4.5 w-4.5 text-white" />
              </button>
              <div className="min-w-0">
                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className="truncate text-base font-bold tracking-tight text-foreground"
                >
                  Lead Management - 2026
                </motion.h1>
                {leads.length > 0 && (
                  <p className="truncate text-[11px] font-medium text-muted-foreground">
                    {filteredLeads.length} of {leads.length} leads • Week {weekRangeLabel}
                  </p>
                )}
              </div>
            </div>
            {leads.length > 0 && (
              <div className="order-last w-full basis-full">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <HeaderMetric label="Total" value={performanceSummary.totalLeads.toLocaleString('en-IN')} />
                  <HeaderMetric label="Trials Done" value={performanceSummary.trialsCompleted.toLocaleString('en-IN')} />
                  <HeaderMetric label="Converted" value={performanceSummary.convertedLeads.toLocaleString('en-IN')} tone="success" />
                  <HeaderMetric label="Avg Span" value={performanceSummary.averageConversionSpanDays === null ? '—' : `${performanceSummary.averageConversionSpanDays.toFixed(1)}d`} />
                </div>
              </div>
            )}
            <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:gap-3">
              <div className="lead-scroll-area flex min-w-0 flex-1 overflow-x-auto rounded-2xl border border-border/75 bg-muted/70 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] sm:flex-none dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                {views.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => handleViewChange(key)}
                    className={`theme-contrast-hover flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                      view === key
                        ? 'bg-card text-foreground shadow-sm ring-1 ring-primary/20'
                        : 'text-muted-foreground hover:bg-card/75 hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                    {key === 'comparison' && !isComparisonUnlocked && <Lock className="h-3 w-3 opacity-75" />}
                  </button>
                ))}
              </div>
              <ThemeToggle />
              <Button
                variant="outline"
                size="sm"
                onClick={runLeadAudit}
                disabled={leadAudit.isPending}
                className="h-9 shrink-0 gap-1.5 rounded-xl border-border/70 bg-card/90 text-xs font-semibold text-foreground shadow-sm backdrop-blur-xl hover:border-primary/40 hover:bg-primary/10"
              >
                <BrainCircuit className={`h-3.5 w-3.5 ${leadAudit.isPending ? 'animate-pulse' : ''}`} />
                AI Audit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedAssociateForAudit(options.associates[0] ?? '');
                  setIsAssociateAuditDialogOpen(true);
                }}
                disabled={leadAudit.isPending || options.associates.length === 0}
                className="h-9 shrink-0 gap-1.5 rounded-xl border-border/70 bg-card/90 text-xs font-semibold text-foreground shadow-sm backdrop-blur-xl hover:border-primary/40 hover:bg-primary/10"
              >
                <UserRound className="h-3.5 w-3.5" />
                Associate Report
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-9 shrink-0 gap-1.5 rounded-xl border-border/70 bg-card/90 text-xs font-semibold text-foreground shadow-sm backdrop-blur-xl hover:border-primary/40 hover:bg-primary/10"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
        </div>
      </header>

      <main className={`relative z-10 ${isTableWorkspace ? 'h-[calc(100vh-8.25rem)] w-full overflow-hidden px-0 py-0 sm:h-[calc(100vh-4rem)]' : view === 'journey-flow' ? 'w-full space-y-5 px-4 py-5 md:px-6' : 'mx-auto max-w-[1680px] space-y-5 px-4 py-5 md:px-6'}`}>
        {error && (
          <div className="glass-strong rounded-2xl border border-accent-overdue/20 p-4 shadow-sm">
            <p className="text-sm text-accent-overdue">
              {error instanceof Error ? error.message : 'Connection to Google Sheets interrupted. Retrying...'}
            </p>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="relative mb-5 flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-primary/20" />
              <div className="absolute inset-[5px] animate-spin rounded-full border-2 border-transparent border-t-primary border-r-primary/70" />
              <div className="absolute inset-[14px] rounded-full border border-primary/10" />
              <Loader2 className="h-4.5 w-4.5 animate-spin text-primary/80" />
            </div>
            <p className="text-sm font-medium text-foreground/90">Loading leads from Google Sheets...</p>
            <p className="mt-1 text-xs text-muted-foreground">Warming up the dashboard...</p>
          </div>
        )}

        {!isLoading && leads.length > 0 && (
          <>
            {!isTableWorkspace && <LeadFilters filters={filters} onChange={setFilters} leads={leads} />}
            {view === 'table' && <LeadTable leads={filteredLeads} allLeads={leads} options={options} filters={filters} onFiltersChange={setFilters} density="comfortable" />}
            {view === 'compact' && <LeadTable leads={filteredLeads} allLeads={leads} options={options} filters={filters} onFiltersChange={setFilters} density="compact" />}
            {view === 'periodic' && <PeriodicAnalytics leads={periodicLeads} />}
            {view === 'journey-flow' && <JourneyFlow leads={filteredLeads} />}
            {view === 'stage-board' && <LeadBoard leads={filteredLeads} allLeads={leads} options={options} groupBy="stageName" title="Stage board" />}
            {view === 'center-board' && <LeadBoard leads={filteredLeads} allLeads={leads} options={options} groupBy="center" title="Center board" />}
            {view === 'associate' && <AssociateOverview leads={filteredLeads} allLeads={leads} options={options} />}
            {view === 'comparison' && isComparisonUnlocked && <LeadComparison leads={filteredLeads} />}
          </>
        )}

        {!isLoading && !error && leads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No leads found. Check your Google Sheets connection.</p>
          </div>
        )}
      </main>

      <Dialog open={isComparisonDialogOpen} onOpenChange={setIsComparisonDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl border-border/50 bg-background/95 p-0 overflow-hidden">
          <div className="border-b border-border/30 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4 text-primary" /> Unlock comparison view
              </DialogTitle>
              <DialogDescription>
                Enter the secret code to access the comparison dashboard.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Secret code</label>
              <Input
                value={comparisonCode}
                onChange={(event) => setComparisonCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    unlockComparisonView();
                  }
                }}
                inputMode="numeric"
                placeholder="Enter code"
                className="h-11 rounded-2xl border-border/50 bg-background/80"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/30 px-6 py-4">
            <Button variant="outline" className="rounded-xl" onClick={() => setIsComparisonDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={unlockComparisonView}>Unlock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssociateAuditDialogOpen} onOpenChange={setIsAssociateAuditDialogOpen}>
        <DialogContent className="sm:max-w-md overflow-hidden rounded-3xl border-border/50 bg-background/95 p-0">
          <div className="border-b border-border/30 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <UserRound className="h-4 w-4 text-primary" /> Associate AI report
              </DialogTitle>
              <DialogDescription>
                Generate a DeepSeek analysis for one associate using the current dashboard filters.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-2 px-6 py-5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Associate</label>
            <select
              value={selectedAssociateForAudit}
              onChange={(event) => setSelectedAssociateForAudit(event.target.value)}
              className="h-11 w-full rounded-2xl border border-border/50 bg-background/80 px-3 text-sm text-foreground"
            >
              {options.associates.map((associate) => (
                <option key={associate} value={associate}>{associate}</option>
              ))}
            </select>
            {selectedAssociateForAudit && (
              <p className="text-xs text-muted-foreground">
                {filteredLeads.filter((lead) => lead.associate === selectedAssociateForAudit).length} filtered leads will be analyzed.
              </p>
            )}
          </div>
          <DialogFooter className="border-t border-border/30 px-6 py-4">
            <Button variant="outline" className="rounded-xl" onClick={() => setIsAssociateAuditDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={runAssociateAudit} disabled={leadAudit.isPending}>
              <BrainCircuit className="h-4 w-4" /> Generate report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAuditDialogOpen} onOpenChange={setIsAuditDialogOpen}>
        <DialogContent className="max-h-[86vh] overflow-hidden rounded-3xl border-border/50 bg-background/95 p-0 sm:max-w-3xl">
          <div className="border-b border-border/30 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <BrainCircuit className="h-4 w-4 text-primary" /> DeepSeek lead audit
              </DialogTitle>
              <DialogDescription>
                {auditScopeLabel}. Capped to a maximum one-month lead window.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="lead-scroll-area max-h-[62vh] space-y-4 overflow-auto px-6 py-5">
            {auditPayload && (
              <div className="grid gap-3 sm:grid-cols-5">
                <AuditMetric label="Window leads" value={`${auditPayload.analysisWindow.includedLeads}/${auditPayload.analysisWindow.requestedLeads}`} />
                <AuditMetric label="Active" value={String(auditPayload.summary.activeLeads)} />
                <AuditMetric label="Sold/converted" value={String(auditPayload.summary.convertedOrSoldLeads)} />
                <AuditMetric label="Local flags" value={String(auditPayload.summary.deterministicIssueCount)} />
                <AuditMetric label="Max period" value={`${auditPayload.analysisWindow.maxDays}d`} />
              </div>
            )}

            {leadAudit.isPending && (
              <div className="rounded-2xl border border-border bg-muted/45 p-5 text-sm text-muted-foreground">
                Running DeepSeek audit on compact issue payload...
              </div>
            )}

            {!leadAudit.isPending && auditResult && (
              <AuditResultView result={auditResult} payload={auditPayload} />
            )}

            {!leadAudit.isPending && !auditResult && auditPayload && (
              <AuditLocalPreview payload={auditPayload} />
            )}
          </div>

          <DialogFooter className="border-t border-border/30 px-6 py-4">
            <Button variant="outline" className="rounded-xl" onClick={() => setIsAuditDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
