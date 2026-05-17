import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useLeadsData } from '@/hooks/useLeadsData';
import { LeadTable } from '@/components/LeadTable';
import { LeadFilters } from '@/components/LeadFilters';
import { AssociateOverview } from '@/components/AssociateOverview';
import { LeadBoard } from '@/components/LeadBoard';
import { LeadComparison } from '@/components/LeadComparison';
import { JourneyFlow } from '@/components/JourneyFlow';
import { PeriodicAnalytics } from '@/components/PeriodicAnalytics';
import { defaultFilters } from '@/types/leads';
import type { FilterState, ViewMode, Lead } from '@/types/leads';
import { RefreshCw, LayoutList, Users, Loader2, Zap, Rows3, GitCompareArrows, Building2, Workflow, Lock, CalendarRange, Moon, Sun, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { applyLeadFilters, buildLeadOptions, getCurrentWeekRangeLabel } from '@/lib/lead-utils';

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

const Index = () => {
  const { data: leads = [], isLoading, error, refetch, isFetching } = useLeadsData();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [view, setView] = useState<ViewMode>('table');
  const [isComparisonUnlocked, setIsComparisonUnlocked] = useState(false);
  const [isComparisonDialogOpen, setIsComparisonDialogOpen] = useState(false);
  const [comparisonCode, setComparisonCode] = useState('');

  const filteredLeads = useMemo(() => applyLeadFilters(leads, filters), [leads, filters]);
  const options = useMemo(() => buildLeadOptions(leads), [leads]);
  const weekRangeLabel = useMemo(() => getCurrentWeekRangeLabel(), []);
  const isTableWorkspace = view === 'table' || view === 'compact';

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
        <div className={`${isTableWorkspace ? 'w-full px-4 md:px-6' : 'mx-auto max-w-[1680px] px-4 md:px-6'} flex min-h-16 flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:py-0`}>
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#7f1231,#9f1d4c,#6d4bc4)] shadow-[0_16px_30px_-18px_rgba(127,18,49,0.72)] ring-1 ring-white/70 dark:ring-rose-200/20">
                <Zap className="h-4.5 w-4.5 text-white" />
              </div>
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
            <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:gap-3">
              <div className="lead-scroll-area flex min-w-0 flex-1 overflow-x-auto rounded-2xl border border-border/75 bg-muted/70 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] sm:flex-none dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                {views.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => handleViewChange(key)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
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

      <main className={`relative z-10 ${isTableWorkspace ? 'h-[calc(100vh-8.25rem)] w-full overflow-hidden px-0 py-0 sm:h-[calc(100vh-4rem)]' : 'mx-auto max-w-[1680px] space-y-5 px-4 py-5 md:px-6'}`}>
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
            {view === 'periodic' && <PeriodicAnalytics leads={filteredLeads} />}
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
    </div>
  );
};

export default Index;
