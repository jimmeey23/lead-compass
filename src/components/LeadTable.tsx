import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ArrowUpDown, ArrowUp, ArrowDown, Check, ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown, ChevronDown, ChevronRight as ChevronRightIcon, CircleSlash, Layers3, MessageSquarePlus, PanelLeftClose, PanelLeftOpen, Search, RotateCcw, SlidersHorizontal, Sparkles, CalendarRange, Pin, PinOff, MapPin, UserRound, Users } from 'lucide-react';
import type { DatePreset, FilterState, GroupableLeadKey, Lead, LeadOptionSets } from '@/types/leads';
import type { FollowUp } from '@/types/leads';
import { parseDateStr } from '@/types/leads';
import { FollowUpTimeline } from './FollowUpTimeline';
import { LeadDrillDown } from './LeadDrillDown';
import { computeAssociateStats } from './AssociateOverview';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import {
  buildCountSummary,
  buildStageCountSummary,
  cleanLooseText,
  GROUPABLE_COLUMNS,
  flattenGroupedLeads,
  getElapsedDaysLabel,
  type LeadRenderDataRow,
} from '@/lib/lead-utils';
import { LeadHoverInfo } from './LeadDisplay';
import { Button } from '@/components/ui/button';
import { MultiSelectDropdown } from './MultiSelectDropdown';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { defaultFilters } from '@/types/leads';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildMomencePayload, useUpdateLead } from '@/hooks/useLeadsData';
import { toast } from '@/components/ui/sonner';
import { DatePickerField } from './DatePickerField';

interface Props {
  leads: Lead[];
  allLeads: Lead[];
  options: LeadOptionSets;
  filters?: FilterState;
  onFiltersChange?: (filters: FilterState) => void;
  density?: 'comfortable' | 'compact';
}

type SortKey = 'fullName' | 'createdAt' | 'associate' | 'status' | 'stageName' | 'sourceName' | 'remarks';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE_OPTIONS = [100, 200, 500];

const QUICK_PERIOD_OPTIONS: Array<{ value: DatePreset; label: string }> = [
  { value: 'lastWeek', label: 'Last week' },
  { value: 'thisWeek', label: 'This week' },
  { value: '7days', label: 'Last 7 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'all', label: 'All time' },
];

const DATE_PRESET_OPTIONS: Array<{ value: DatePreset; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: '7days', label: 'Last 7 days' },
  { value: 'lastWeek', label: 'Last week' },
  { value: 'thisWeek', label: 'This week' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'thisQuarter', label: 'This quarter' },
  { value: 'lastQuarter', label: 'Last quarter' },
  { value: 'thisYear', label: 'This year' },
  { value: 'lastYear', label: 'Last year' },
  { value: 'custom', label: 'Custom period' },
];

const TABLE_COLUMNS: Array<{ key: string; label: string; width: number; sortKey?: SortKey }> = [
  { key: 'rowNumber', label: '#', width: 72 },
  { key: 'fullName', label: 'Lead', width: 250, sortKey: 'fullName' },
  { key: 'createdAt', label: 'Date', width: 140, sortKey: 'createdAt' },
  { key: 'associate', label: 'Associate', width: 150, sortKey: 'associate' },
  { key: 'sourceName', label: 'Source', width: 160, sortKey: 'sourceName' },
  { key: 'stageName', label: 'Stage', width: 190, sortKey: 'stageName' },
  { key: 'remarks', label: 'Remarks', width: 340 },
  { key: 'followUps', label: 'Follow-ups', width: 200 },
  { key: 'center', label: 'Center', width: 220 },
  { key: 'type', label: 'Type', width: 140 },
  { key: 'ltv', label: 'LTV', width: 120 },
];

export function LeadTable({ leads, allLeads, options, filters, onFiltersChange, density = 'comfortable' }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [groupKeys, setGroupKeys] = useState<GroupableLeadKey[]>([]);
  const [groupToAdd, setGroupToAdd] = useState<GroupableLeadKey | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<string[]>([]);
  const [isStageSummaryCollapsed, setIsStageSummaryCollapsed] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false
  ));
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isSidebarInteracting, setIsSidebarInteracting] = useState(false);
  const [isQuickFiltersOpen, setIsQuickFiltersOpen] = useState(false);
  const [quickFollowUpLead, setQuickFollowUpLead] = useState<Lead | null>(null);
  const [quickFollowUpItem, setQuickFollowUpItem] = useState<FollowUp | null>(null);
  const [quickFollowUpComment, setQuickFollowUpComment] = useState('');
  const [columnWidths, setColumnWidths] = useState<number[]>(() => TABLE_COLUMNS.map((column) => column.width));
  const resizeStateRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const updateLead = useUpdateLead();

  const sorted = useMemo(() => {
    const result = [...leads];
    result.sort((a, b) => {
      const valA = getSortValue(a, sortKey);
      const valB = getSortValue(b, sortKey);
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [leads, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const associateStats = useMemo(() => computeAssociateStats(allLeads), [allLeads]);
  const renderedRows = useMemo(() => flattenGroupedLeads(sorted, groupKeys), [groupKeys, sorted]);
  const groupRows = useMemo(() => renderedRows.filter((row) => row.type === 'group'), [renderedRows]);
  const visibleRows = useMemo(() => {
    let visibleLeadCounter = 0;

    return renderedRows
      .filter((row) => !row.parentGroupIds.some((id) => collapsedGroupIds.includes(id)))
      .map((row) => {
        if (row.type === 'group') return row;
        visibleLeadCounter += 1;
        return { ...row, rowNumber: visibleLeadCounter };
      });
  }, [collapsedGroupIds, renderedRows]);
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const pagedRows = useMemo(() => visibleRows.slice((page - 1) * pageSize, page * pageSize), [page, pageSize, visibleRows]);
  const displayedLeads = useMemo(
    () => pagedRows.filter((row): row is LeadRenderDataRow => row.type === 'lead').map((row) => row.lead),
    [pagedRows],
  );
  const displayedStageSummary = useMemo(() => buildStageCountSummary(sorted), [sorted]);
  const displayedSourceSummary = useMemo(() => buildCountSummary(sorted, 'sourceName'), [sorted]);
  const activeFilterCount = useMemo(() => {
    if (!filters) return 0;

    return Object.entries(filters).filter(([key, value]) => {
      if (key === 'search') return Boolean(value);
      if (key === 'datePreset') return value !== 'all';
      if (key === 'convertedDatePreset') return value !== 'all';
      if (key === 'customDateFrom' || key === 'customDateTo' || key === 'convertedDateFrom' || key === 'convertedDateTo') return false;
      if (Array.isArray(value)) return value.length > 0;
      return value !== 'all';
    }).length;
  }, [filters]);
  const centerScopedAssociates = useMemo(() => {
    if (!filters || filters.center === 'all') {
      return options.associates;
    }

    return Array.from(
      new Set(
        allLeads
          .filter((lead) => cleanLooseText(lead.center) === cleanLooseText(filters.center))
          .map((lead) => lead.associate)
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [allLeads, filters, options.associates]);
  const centerOptions = useMemo(() => {
    const selectedCenter = filters?.center && filters.center !== 'all' ? [filters.center] : [];
    return Array.from(new Set([...selectedCenter, ...options.centers]));
  }, [filters?.center, options.centers]);

  useEffect(() => {
    setPage(1);
  }, [leads, groupKeys, pageSize, sortKey, sortDir]);

  useEffect(() => {
    setCollapsedGroupIds([]);
  }, [groupKeys]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (!filters || !onFiltersChange) return;
    if (filters.center === 'all' || filters.associate === 'all') return;
    if (centerScopedAssociates.includes(filters.associate)) return;

    onFiltersChange({ ...filters, associate: 'all' });
  }, [centerScopedAssociates, filters, onFiltersChange]);

  useEffect(() => {
    if (isSidebarCollapsed || isSidebarPinned || isSidebarInteracting) return;

    const timer = window.setTimeout(() => {
      setIsSidebarCollapsed(true);
    }, 9000);

    return () => window.clearTimeout(timer);
  }, [isSidebarCollapsed, isSidebarInteracting, isSidebarPinned]);

  useEffect(() => {
    const handlePointerMove = (event: MouseEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;

      const delta = event.clientX - resizeState.startX;
      setColumnWidths((current) => {
        const next = [...current];
        next[resizeState.index] = Math.max(72, resizeState.startWidth + delta);
        return next;
      });
    };

    const stopResize = () => {
      resizeStateRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', stopResize);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', stopResize);
    };
  }, []);

  const addGroup = () => {
    if (!groupToAdd || groupKeys.includes(groupToAdd)) return;
    setGroupKeys((current) => [...current, groupToAdd]);
    setGroupToAdd('');
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroupIds((current) => current.includes(groupId)
      ? current.filter((id) => id !== groupId)
      : [...current, groupId]);
  };

  const collapseAllGroups = () => setCollapsedGroupIds(groupRows.map((row) => row.id));
  const expandAllGroups = () => setCollapsedGroupIds([]);

  const startColumnResize = (index: number, event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      index,
      startX: event.clientX,
      startWidth: columnWidths[index],
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const availableGroupColumns = GROUPABLE_COLUMNS.filter(({ key }) => !groupKeys.includes(key));
  const rowHeightClass = 'h-10 max-h-10';
  const summaryRowsToShow = isStageSummaryCollapsed ? 8 : Math.max(displayedStageSummary.length, displayedSourceSummary.length);
  const sidebarStatCards = [
    { label: 'Visible', value: String(visibleRows.length) },
    { label: 'Page', value: `${page}/${totalPages}` },
    { label: 'Groups', value: String(groupKeys.length) },
    { label: 'Rows', value: String(sorted.length) },
  ];

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 text-primary" />
      : <ArrowDown className="h-3 w-3 text-primary" />;
  };

  const openQuickFollowUpEditor = (lead: Lead, followUp: FollowUp) => {
    setQuickFollowUpLead(lead);
    setQuickFollowUpItem(followUp);
    setQuickFollowUpComment(followUp.comment === '-' ? '' : followUp.comment);
  };

  const closeQuickFollowUpEditor = () => {
    setQuickFollowUpLead(null);
    setQuickFollowUpItem(null);
    setQuickFollowUpComment('');
  };

  const saveQuickFollowUpComment = async () => {
    if (!quickFollowUpLead || !quickFollowUpItem) return;

    const updatedFollowUps = quickFollowUpLead.followUps.map((item) => (
      item.index === quickFollowUpItem.index
        ? { ...item, comment: quickFollowUpComment.trim() || '-' }
        : item
    ));

    try {
      await updateLead.mutateAsync({
        leadId: quickFollowUpLead.id,
        payload: buildMomencePayload(quickFollowUpLead, {
          ...quickFollowUpLead,
          followUps: updatedFollowUps,
        }),
      });

      toast.success('Follow-up comment saved');
      closeQuickFollowUpEditor();
    } catch (error) {
      toast.error('Unable to save follow-up comment', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred while saving the comment.',
      });
    }
  };

  return (
    <>
      <div className="premium-panel mx-3 mt-3 flex h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] min-h-0 overflow-hidden rounded-[22px]">
        <aside
          ref={sidebarRef}
          onMouseEnter={() => setIsSidebarInteracting(true)}
          onMouseLeave={() => setIsSidebarInteracting(false)}
          onFocusCapture={() => setIsSidebarInteracting(true)}
          onBlurCapture={(event) => {
            if (!sidebarRef.current?.contains(event.relatedTarget as Node | null)) {
              setIsSidebarInteracting(false);
            }
          }}
          className={`flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-border/75 bg-card/95 text-card-foreground shadow-[inset_-1px_0_0_rgba(37,99,235,0.08)] transition-[width] duration-300 dark:bg-card/80 dark:shadow-[inset_-1px_0_0_rgba(125,211,252,0.12)] ${isSidebarCollapsed ? 'w-[64px]' : 'w-[360px]'}`}
        >
          <div className={`flex h-14 items-center border-b border-border/75 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-blue-950/70 ${isSidebarCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-4 py-3'}`}>
            {!isSidebarCollapsed ? (
              <div>
                <p className="text-sm font-semibold text-foreground">Command panel</p>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Filters · Groups · Counts</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-primary/20 bg-card p-1.5 shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              className={`rounded-xl p-0 text-muted-foreground hover:bg-primary/10 hover:text-primary ${isSidebarCollapsed ? 'absolute right-2 top-3 h-8 w-8' : 'h-9 w-9'}`}
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
            {!isSidebarCollapsed && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarPinned((current) => !current)}
                className="h-9 w-9 rounded-xl p-0 text-muted-foreground hover:bg-primary/10 hover:text-primary"
              >
                {isSidebarPinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
              </Button>
            )}
          </div>

          {isSidebarCollapsed ? (
            <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-hidden px-2 py-3">
              <CollapsedRailButton icon={SlidersHorizontal} label="Filters" onClick={() => setIsSidebarCollapsed(false)} />
              <CollapsedRailButton icon={Layers3} label="Groups" value={String(groupKeys.length)} onClick={() => setIsSidebarCollapsed(false)} />
              <CollapsedRailButton icon={Sparkles} label="Rows" value={String(sorted.length)} onClick={() => setIsSidebarCollapsed(false)} />
              <CollapsedRailButton icon={CalendarRange} label="Page" value={`${page}`} onClick={() => setIsSidebarCollapsed(false)} />
              <div className="mt-auto flex h-16 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primary/10 px-1 text-[8px] font-semibold uppercase tracking-[0.24em] text-primary [writing-mode:vertical-rl] rotate-180">
                Rail
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-4">
                <section className="rounded-[20px] border border-border/70 bg-card/80 p-3.5 shadow-[0_14px_34px_-30px_rgba(37,99,235,0.55)] dark:bg-white/[0.035]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">Overview</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">A quick pulse of the visible workspace.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {sidebarStatCards.map((card) => (
                      <SidebarStatCard key={card.label} label={card.label} value={card.value} />
                    ))}
                  </div>
                </section>

                <section className="rounded-[20px] border border-border/70 bg-card/80 p-3.5 shadow-[0_14px_34px_-30px_rgba(37,99,235,0.55)] dark:bg-white/[0.035]">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground">Counts</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">For the full filtered result set.</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-xl px-2 text-[11px] text-primary hover:bg-primary/10 hover:text-primary"
                      onClick={() => setIsStageSummaryCollapsed((current) => !current)}
                    >
                      {isStageSummaryCollapsed ? 'More' : 'Less'}
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <SummaryCountTable title="Stages" rows={displayedStageSummary} rowLimit={summaryRowsToShow} totalCount={sorted.length} dark />
                    <SummaryCountTable title="Sources" rows={displayedSourceSummary} rowLimit={summaryRowsToShow} totalCount={sorted.length} dark />
                  </div>
                </section>

                {filters && onFiltersChange && (
                  <section className="rounded-[20px] border border-border/70 bg-card/80 p-3.5 shadow-[0_14px_34px_-30px_rgba(37,99,235,0.55)] dark:bg-white/[0.035]">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4 text-primary" />
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground">Filters</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeFilterCount > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onFiltersChange(defaultFilters)}
                            className="h-8 rounded-xl px-2 text-[11px] text-primary hover:bg-primary/10 hover:text-primary"
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Search</label>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={filters.search}
                            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
                            placeholder="Name, phone, email, ID"
                            className="h-10 rounded-xl border-border/70 bg-background/80 pl-10 text-sm text-foreground placeholder:text-muted-foreground"
                          />
                        </div>
                      </div>

                      <SidebarSelect
                        label="Lead created"
                        value={filters.datePreset}
                        onChange={(value) => onFiltersChange({ ...filters, datePreset: value as DatePreset })}
                        options={DATE_PRESET_OPTIONS.map((option) => ({ label: option.label, value: option.value }))}
                      />
                      {filters.datePreset === 'custom' && (
                        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border/60 bg-primary/5 p-3">
                          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            <CalendarRange className="h-3.5 w-3.5 text-primary" /> Custom range
                          </div>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <DatePickerField
                              label="From"
                              value={filters.customDateFrom}
                              onChange={(value) => onFiltersChange({ ...filters, customDateFrom: value })}
                            />
                            <DatePickerField
                              label="To"
                              value={filters.customDateTo}
                              onChange={(value) => onFiltersChange({ ...filters, customDateTo: value })}
                            />
                          </div>
                        </div>
                      )}
                      <SidebarSelect
                        label="Converted"
                        value={filters.convertedDatePreset}
                        onChange={(value) => onFiltersChange({ ...filters, convertedDatePreset: value as DatePreset })}
                        options={DATE_PRESET_OPTIONS.map((option) => ({ label: option.label, value: option.value }))}
                      />
                      {filters.convertedDatePreset === 'custom' && (
                        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border/60 bg-primary/5 p-3">
                          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            <CalendarRange className="h-3.5 w-3.5 text-primary" /> Converted range
                          </div>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <DatePickerField
                              label="From"
                              value={filters.convertedDateFrom}
                              onChange={(value) => onFiltersChange({ ...filters, convertedDateFrom: value })}
                            />
                            <DatePickerField
                              label="To"
                              value={filters.convertedDateTo}
                              onChange={(value) => onFiltersChange({ ...filters, convertedDateTo: value })}
                            />
                          </div>
                        </div>
                      )}
                      <SidebarSelect
                        label="Associate"
                        value={filters.associate}
                        onChange={(value) => onFiltersChange({ ...filters, associate: value })}
                        options={[{ label: 'All associates', value: 'all' }, ...centerScopedAssociates.map((associate) => ({ label: associate, value: associate }))]}
                      />
                      <SidebarSelect
                        label="Center"
                        value={filters.center}
                        onChange={(value) => onFiltersChange({ ...filters, center: value })}
                        options={[{ label: 'All centers', value: 'all' }, ...centerOptions.map((center) => ({ label: center, value: center }))]}
                      />
                      <SidebarMultiSelect label="Stage" options={options.stageNames} selected={filters.stageName} onChange={(stageName) => onFiltersChange({ ...filters, stageName })} />
                      <SidebarMultiSelect label="Source" options={options.sourceNames} selected={filters.sourceName} onChange={(sourceName) => onFiltersChange({ ...filters, sourceName })} />
                      <SidebarMultiSelect label="Status" options={options.statuses} selected={filters.status} onChange={(status) => onFiltersChange({ ...filters, status })} />
                      <SidebarMultiSelect label="Channel" options={options.channels} selected={filters.channel} onChange={(channel) => onFiltersChange({ ...filters, channel })} />
                      <SidebarMultiSelect label="Conversion" options={options.conversionStatuses} selected={filters.conversionStatus} onChange={(conversionStatus) => onFiltersChange({ ...filters, conversionStatus })} />
                      <SidebarMultiSelect label="Trial status" options={options.trialStatuses} selected={filters.trialStatus} onChange={(trialStatus) => onFiltersChange({ ...filters, trialStatus })} />
                    </div>
                  </section>
                )}

                  <section className="rounded-[20px] border border-border/70 bg-card/80 p-3.5 shadow-[0_14px_34px_-30px_rgba(37,99,235,0.55)] dark:bg-white/[0.035]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Layers3 className="h-4 w-4 text-primary" />
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground">Grouping</p>
                    </div>
                    <select
                      value={pageSize}
                      onChange={(event) => setPageSize(Number(event.target.value))}
                      className="h-7 rounded-lg border border-border/70 bg-background/80 px-2 text-[10px] font-medium text-foreground"
                    >
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>{size}/page</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <SidebarSelect
                      label="Add grouping"
                      value={groupToAdd}
                      onChange={(value) => setGroupToAdd(value as GroupableLeadKey | '')}
                      options={[{ label: 'Select grouping', value: '' }, ...availableGroupColumns.map((column) => ({ label: column.label, value: column.key }))]}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={addGroup} disabled={!groupToAdd} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">Add</Button>
                      {groupKeys.length > 0 && (
                        <Button type="button" variant="outline" onClick={() => setGroupKeys([])} className="rounded-xl border-border/70 bg-background/70 text-foreground hover:bg-primary/10">Clear</Button>
                      )}
                      {groupRows.length > 0 && (
                        <>
                          <Button type="button" variant="outline" onClick={expandAllGroups} className="rounded-xl border-border/70 bg-background/70 text-foreground hover:bg-primary/10">
                            <ChevronsDownUp className="mr-1.5 h-4 w-4" /> Expand
                          </Button>
                          <Button type="button" variant="outline" onClick={collapseAllGroups} className="rounded-xl border-border/70 bg-background/70 text-foreground hover:bg-primary/10">
                            <ChevronsUpDown className="mr-1.5 h-4 w-4" /> Collapse
                          </Button>
                        </>
                      )}
                    </div>
                    {groupKeys.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {groupKeys.map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setGroupKeys((current) => current.filter((item) => item !== key))}
                            className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary"
                          >
                            {GROUPABLE_COLUMNS.find((column) => column.key === key)?.label} ×
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

              </div>
            </div>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background/80 dark:bg-slate-950/30">
          <div className="min-h-0 flex-1 overflow-auto lead-scroll-area">
          <table className="w-full border-separate border-spacing-0" style={{ minWidth: `${columnWidths.reduce((sum, width) => sum + width, 0)}px` }}>
            <colgroup>
              {columnWidths.map((width, index) => (
                <col key={TABLE_COLUMNS[index].key} style={{ width: `${width}px` }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10 lead-table-head">
              <tr className="lead-table-header">
                {TABLE_COLUMNS.map((column, index) => (
                  <th
                    key={column.key}
                    onClick={column.sortKey ? () => toggleSort(column.sortKey!) : undefined}
                    style={{ width: `${columnWidths[index]}px`, minWidth: `${columnWidths[index]}px` }}
                    className={`group/column relative h-12 px-4 text-left text-[10px] uppercase tracking-widest font-semibold text-white/90 whitespace-nowrap ${column.sortKey ? 'cursor-pointer select-none transition-colors hover:text-white' : ''}`}
                  >
                    <span className="inline-flex items-center gap-1 pr-4">
                      {column.label} {column.sortKey ? <SortIcon col={column.sortKey} /> : null}
                    </span>
                    {index < TABLE_COLUMNS.length && (
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Resize ${column.label} column`}
                        onMouseDown={(event) => startColumnResize(index, event)}
                        className="absolute right-0 top-1/2 h-6 w-2 -translate-y-1/2 cursor-col-resize rounded-full bg-transparent transition-colors before:absolute before:left-1/2 before:top-0 before:h-full before:w-px before:-translate-x-1/2 before:bg-white/20 hover:bg-white/10 hover:before:bg-sky-300"
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => {
                if (row.type === 'group') {
                  const collapsed = collapsedGroupIds.includes(row.id);
                  return (
                    <tr key={row.id} className="h-11 cursor-pointer bg-blue-700 text-blue-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-blue-600 dark:bg-blue-950 dark:hover:bg-blue-900">
                      <td className="border-b border-blue-600/70 px-4 py-2 align-middle text-xs font-mono text-blue-100 whitespace-nowrap">{row.groupNumber}</td>
                      <td colSpan={10} className="border-b border-blue-600/70 px-4 py-2 align-middle dark:border-blue-900" onClick={() => toggleGroup(row.id)}>
                        <div className="flex items-center gap-3" style={{ paddingLeft: `${row.depth * 18}px` }}>
                          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-50/95 shrink-0">
                            {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            {GROUPABLE_COLUMNS.find((column) => column.key === row.groupKey)?.label}: {row.label}
                          </span>
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <GroupMetricPill icon={Users} label="Leads" value={row.groupMetrics.leadCount} />
                            <GroupMetricPill icon={Check} label="Converted" value={row.groupMetrics.converted} />
                            <GroupMetricPill icon={Check} label="Trials completed" value={row.groupMetrics.trialsCompleted} />
                            <GroupMetricPill icon={CalendarRange} label="Trials scheduled" value={row.groupMetrics.trialsScheduled} />
                            <GroupMetricPill icon={CircleSlash} label="Disqualified" value={row.groupMetrics.disqualified} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <LeadDataRow
                    key={row.id}
                    row={row}
                    density={density}
                    rowHeightClass={rowHeightClass}
                    onQuickFollowUpEdit={openQuickFollowUpEditor}
                    onSelect={setSelectedLead}
                  />
                );
              })}
            </tbody>
          </table>
          </div>

          <div className="flex items-center justify-between border-t border-border/75 bg-card/90 px-5 py-2.5 shadow-[0_-16px_40px_-34px_rgba(15,23,42,0.8)] dark:bg-card/80">
          <p className="text-[11px] text-muted-foreground">Showing <span className="font-mono-data font-semibold text-foreground">{pagedRows.length}</span> rows on this page.</p>
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg px-2.5 text-[11px]" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <div className="rounded-lg border border-border/40 bg-background/80 px-2.5 py-1.5 text-[11px] font-mono-data text-muted-foreground">
              {page}/{totalPages}
            </div>
            <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg px-2.5 text-[11px]" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
        </div>

        {sorted.length === 0 && (
          <div className="p-16 text-center">
            <p className="text-sm text-muted-foreground">No leads match your filters.</p>
          </div>
        )}
      </div>

      {filters && onFiltersChange && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 md:bottom-8 md:right-8">
          {isQuickFiltersOpen && (
            <div className="pointer-events-auto w-[min(420px,calc(100vw-1.5rem))] rounded-[28px] border border-border/40 bg-background/90 p-4 shadow-elevated backdrop-blur-2xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Quick filters</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Fast toggles for period, location, and associate.</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => onFiltersChange(defaultFilters)}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
                </Button>
              </div>

              <div className="space-y-3">
                <QuickFilterRow
                  icon={CalendarRange}
                  label="Created"
                  options={QUICK_PERIOD_OPTIONS}
                  activeValue={filters.datePreset}
                  onSelect={(value) => onFiltersChange({ ...filters, datePreset: value as DatePreset })}
                />
                <QuickFilterRow
                  icon={CalendarRange}
                  label="Converted"
                  options={QUICK_PERIOD_OPTIONS}
                  activeValue={filters.convertedDatePreset}
                  onSelect={(value) => onFiltersChange({ ...filters, convertedDatePreset: value as DatePreset })}
                />
                <QuickFilterRow
                  icon={MapPin}
                  label="Location"
                  options={[{ label: 'All centers', value: 'all' }, ...centerOptions.map((center) => ({ label: center, value: center }))]}
                  activeValue={filters.center}
                  onSelect={(value) => onFiltersChange({ ...filters, center: value, associate: 'all' })}
                />
                <QuickFilterRow
                  icon={UserRound}
                  label="Associate"
                  options={[{ label: 'All associates', value: 'all' }, ...centerScopedAssociates.map((associate) => ({ label: associate, value: associate }))]}
                  activeValue={filters.associate}
                  onSelect={(value) => onFiltersChange({ ...filters, associate: value })}
                />
              </div>
            </div>
          )}

          <Button
            type="button"
            size="sm"
            onClick={() => setIsQuickFiltersOpen((current) => !current)}
            className="pointer-events-auto h-12 rounded-full bg-[linear-gradient(135deg,#1d4ed8,#0ea5e9)] px-4 text-white shadow-[0_18px_40px_-18px_rgba(37,99,235,0.85)] hover:brightness-105"
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" /> Quick filters
          </Button>
        </div>
      )}

      <Dialog open={Boolean(quickFollowUpLead && quickFollowUpItem)} onOpenChange={(open) => { if (!open) closeQuickFollowUpEditor(); }}>
        <DialogContent className="sm:max-w-lg rounded-3xl border-border/50 bg-background/95 p-0 overflow-hidden">
          <div className="border-b border-border/30 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <MessageSquarePlus className="h-4 w-4 text-primary" /> Quick follow-up comment
              </DialogTitle>
              <DialogDescription>
                {quickFollowUpLead && quickFollowUpItem
                  ? `${quickFollowUpLead.fullName} • Follow Up ${quickFollowUpItem.index}${quickFollowUpItem.date ? ` • ${quickFollowUpItem.date}` : ''}`
                  : 'Add or update feedback without opening the full lead editor.'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Comment</label>
              <Textarea
                value={quickFollowUpComment}
                onChange={(event) => setQuickFollowUpComment(event.target.value)}
                placeholder="Add follow-up notes"
                className="min-h-[132px] rounded-2xl border-border/50 bg-background/80"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/30 px-6 py-4">
            <Button variant="outline" className="rounded-xl" onClick={closeQuickFollowUpEditor}>Cancel</Button>
            <Button className="rounded-xl" onClick={saveQuickFollowUpComment} disabled={updateLead.isPending}>
              {updateLead.isPending ? 'Saving…' : 'Save comment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {selectedLead && (
          <>
            <div className="fixed inset-0 bg-foreground/10 backdrop-blur-sm z-[88]" onClick={() => setSelectedLead(null)} />
            <LeadDrillDown
              lead={selectedLead}
              allLeads={allLeads}
              options={options}
              associateStats={associateStats.find(a => a.name === selectedLead.associate)}
              fullscreen
              onClose={() => setSelectedLead(null)}
            />
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function getSortValue(lead: Lead, key: SortKey): string | number {
  if (key === 'createdAt') {
    return parseDateStr(String(lead[key]))?.getTime() || 0;
  }

  return String(lead[key] || '').toLowerCase();
}

function LeadDataRow({
  row,
  density,
  rowHeightClass,
  onQuickFollowUpEdit,
  onSelect,
}: {
  row: LeadRenderDataRow;
  density: 'comfortable' | 'compact';
  rowHeightClass: string;
  onQuickFollowUpEdit: (lead: Lead, followUp: FollowUp) => void;
  onSelect: (lead: Lead) => void;
}) {
  const { lead } = row;
  const emptyRemarks = !lead.remarks || lead.remarks === '-';
  const dateLabel = getElapsedDaysLabel(lead.createdAt);
  const centerPreview = cleanLooseText(lead.center) || '—';
  const typePreview = cleanLooseText(lead.classType) || '—';
  const sourcePreview = cleanLooseText(lead.sourceName) || '—';
  const channelPreview = cleanLooseText(lead.channel) || 'No channel';
  const stagePreview = cleanLooseText(lead.stageName) || '—';
  const ltvPreview = lead.ltv > 0 ? `₹${lead.ltv.toLocaleString()}` : '—';

  return (
    <tr
      onClick={() => onSelect(lead)}
      className={`group cursor-pointer border-b border-border/60 bg-card transition-colors duration-150 odd:bg-card even:bg-muted/40 hover:bg-primary/10 dark:odd:bg-slate-950/30 dark:even:bg-slate-900/30 dark:hover:bg-blue-950/30 ${rowHeightClass}`}
    >
      <td className="px-4 py-2 align-middle text-xs font-mono text-muted-foreground whitespace-nowrap">{row.rowNumber}</td>
      <td className="px-4 py-2 align-middle">
        <HoverCard openDelay={2200} closeDelay={180}>
          <HoverCardTrigger asChild>
            <div className="cursor-default" style={{ paddingLeft: `${row.depth * 16}px` }}>
              <div className="truncate text-sm font-semibold leading-tight text-foreground">{lead.fullName}</div>
            </div>
          </HoverCardTrigger>
          <HoverCardContent side="right" align="start" sideOffset={12} collisionPadding={20} className="z-[120] w-[min(980px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-visible rounded-[24px] border border-border/70 bg-popover p-0 shadow-[0_32px_90px_-40px_rgba(37,99,235,0.45)]">
            <LeadHoverInfo lead={lead} />
          </HoverCardContent>
        </HoverCard>
      </td>
      <td className="px-4 py-2 align-middle">
        <span className="block truncate text-xs font-mono-data text-muted-foreground whitespace-nowrap">{`${lead.createdAt || '—'} · ${dateLabel}`}</span>
      </td>
      <td className="px-4 py-2 align-middle">
        <span className="block truncate text-xs font-medium text-foreground/78 whitespace-nowrap">{lead.associate || '—'}</span>
      </td>
      <td className="px-4 py-2 align-middle">
        <span className="block truncate text-xs font-semibold text-foreground/90">{sourcePreview}</span>
      </td>
      <td className="px-4 py-2 align-middle">
        <span className="block truncate rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{stagePreview}</span>
      </td>
      <td className="px-4 py-2 align-middle">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`block max-w-[320px] truncate cursor-default text-[11px] leading-none ${emptyRemarks ? 'italic text-muted-foreground/40' : 'text-muted-foreground'}`}>
              {emptyRemarks ? 'No remarks' : lead.remarks}
            </span>
          </TooltipTrigger>
          {!emptyRemarks && (
            <TooltipContent side="top" className="max-w-[420px] p-3">
              <p className="text-xs leading-relaxed text-foreground">{lead.remarks}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </td>
      <td className="px-4 py-2 align-middle">
        <FollowUpTimeline followUps={lead.followUps} status={lead.status} compact onQuickEdit={(followUp) => onQuickFollowUpEdit(lead, followUp)} />
      </td>
      <td className="px-4 py-2 align-middle">
        <span className="block truncate text-xs text-foreground">{`${centerPreview}${cleanLooseText(lead.trialStatus) ? ` · ${cleanLooseText(lead.trialStatus)}` : ''}`}</span>
      </td>
      <td className="px-4 py-2 align-middle">
        <span className="block truncate text-xs font-medium text-foreground">{`${typePreview} · ${lead.visits} visits`}</span>
      </td>
      <td className="px-4 py-2 align-middle">
        <span className="block truncate text-xs font-semibold text-foreground font-mono-data">{`${ltvPreview} · ${lead.purchasesMade} purchases`}</span>
      </td>
    </tr>
  );
}

function SummaryCountTable({
  title,
  rows,
  rowLimit,
  totalCount,
  dark = false,
}: {
  title: string;
  rows: Array<{ label: string; count: number; share: number; detail?: string; groupedCount?: number }>;
  rowLimit: number;
  totalCount: number;
  dark?: boolean;
}) {
  const visibleRows = rows.slice(0, rowLimit);

  return (
    <div className={`overflow-hidden rounded-2xl border ${dark ? 'border-border/60 bg-background/70 shadow-sm' : 'border-border/30 bg-background/70'}`}>
      <div className={`flex items-center justify-between border-b px-3 py-2 ${dark ? 'border-border/50 bg-primary/5' : 'border-border/20'}`}>
        <h4 className={`text-[11px] font-semibold uppercase tracking-wider ${dark ? 'text-foreground' : 'text-muted-foreground'}`}>{title}</h4>
        <span className={`rounded-full px-2 py-0.5 font-mono-data text-[10px] font-semibold ${dark ? 'bg-primary/10 text-primary ring-1 ring-primary/20' : 'bg-muted text-foreground'}`}>
          {rows.length} rows
        </span>
      </div>
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[64%]" />
          <col className="w-[17%]" />
          <col className="w-[19%]" />
        </colgroup>
        <thead className={dark ? 'bg-muted/50' : 'bg-muted/25'}>
          <tr>
            <th className={`px-3 py-2 text-left text-[10px] uppercase tracking-wider font-semibold ${dark ? 'text-muted-foreground' : 'text-muted-foreground'}`}>Label</th>
            <th className={`px-2 py-2 text-right text-[10px] uppercase tracking-wider font-semibold ${dark ? 'text-muted-foreground' : 'text-muted-foreground'}`}>Count</th>
            <th className={`px-2 py-2 text-right text-[10px] uppercase tracking-wider font-semibold ${dark ? 'text-muted-foreground' : 'text-muted-foreground'}`}>Share</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.length > 0 ? visibleRows.map((row) => (
            <tr key={row.label} className={`border-t ${dark ? 'border-border/50' : 'border-border/20'}`}>
              <td className={`px-3 py-2 text-xs ${dark ? 'text-foreground' : 'text-foreground'}`}>
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.label}</p>
                  {row.groupedCount && row.groupedCount > 1 && (
                    <p className={`mt-0.5 truncate text-[10px] ${dark ? 'text-muted-foreground' : 'text-muted-foreground'}`} title={row.detail}>
                      {row.groupedCount} stages grouped
                    </p>
                  )}
                </div>
              </td>
              <td className={`px-2 py-2 text-right text-xs font-semibold ${dark ? 'text-foreground' : 'text-foreground'}`}>{row.count}</td>
              <td className={`px-2 py-2 text-right text-xs ${dark ? 'text-muted-foreground' : 'text-muted-foreground'}`}>{row.share.toFixed(1)}%</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={3} className={`px-3 py-4 text-center text-xs ${dark ? 'text-muted-foreground' : 'text-muted-foreground'}`}>No rows match the current filters.</td>
            </tr>
          )}
          <tr className={`border-t ${dark ? 'border-primary/20 bg-primary/10' : 'border-border/30 bg-muted/40'}`}>
            <td className={`px-3 py-2 text-xs font-semibold ${dark ? 'text-foreground' : 'text-foreground'}`}>Total</td>
            <td className={`px-2 py-2 text-right font-mono-data text-xs font-bold ${dark ? 'text-foreground' : 'text-foreground'}`}>{totalCount}</td>
            <td className={`px-2 py-2 text-right text-xs font-semibold ${dark ? 'text-muted-foreground' : 'text-muted-foreground'}`}>{totalCount > 0 ? '100.0%' : '0.0%'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SidebarStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-primary/20 bg-gradient-to-br from-card to-primary/10 px-3 py-2.5 shadow-sm">
      <p className="truncate text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-mono-data text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function CollapsedRailButton({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: typeof Sparkles;
  label: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-11 w-11 flex-col items-center justify-center rounded-2xl border border-primary/20 bg-card text-muted-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
      aria-label={value ? `${label}: ${value}` : label}
      title={value ? `${label}: ${value}` : label}
    >
      <Icon className="h-3.5 w-3.5 text-primary transition-transform group-hover:scale-105" />
      {value && <span className="mt-1 font-mono-data text-[9px] font-semibold leading-none text-foreground">{value}</span>}
    </button>
  );
}

function QuickFilterRow({
  icon: Icon,
  label,
  options,
  activeValue,
  onSelect,
}: {
  icon: typeof Sparkles;
  label: string;
  options: Array<{ label: string; value: string }>;
  activeValue: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="rounded-xl bg-primary/10 p-1.5 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">{label}</span>
      </div>
      <div className="lead-table-controls-strip flex gap-2 overflow-x-auto pb-1">
        {options.map((option) => {
          const active = option.value === activeValue;
          return (
            <button
              key={`${label}-${option.value}`}
              type="button"
              onClick={() => onSelect(option.value)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${active
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border/50 bg-background/80 text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-foreground'}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GroupMetricPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-medium text-blue-50 backdrop-blur">
      <Icon className="h-3 w-3 text-blue-100" />
      <span className="text-blue-100/80">{label}</span>
      <span className="font-mono-data text-white">{value}</span>
    </span>
  );
}

function SidebarSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-border/70 bg-background/80 px-3 text-sm text-foreground"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

function SidebarMultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <MultiSelectDropdown
        label={label}
        options={options}
        selected={selected}
        onChange={onChange}
        allLabel="All"
        buttonClassName="h-10 w-full justify-between rounded-xl border border-border/70 bg-background/80 px-3 text-sm font-normal text-foreground"
      />
    </div>
  );
}
