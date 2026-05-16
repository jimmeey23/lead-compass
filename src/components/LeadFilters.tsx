import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Search, X, SlidersHorizontal, Calendar, MapPin, UserCircle } from 'lucide-react';
import { useState } from 'react';
import type { FilterState, Lead, DatePreset } from '@/types/leads';
import { defaultFilters } from '@/types/leads';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MultiSelectDropdown } from './MultiSelectDropdown';
import { DatePickerField } from './DatePickerField';

interface Props {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  leads: Lead[];
}

function getUnique(leads: Lead[], key: keyof Lead): string[] {
  const values = new Set(leads.map(l => String(l[key])).filter(Boolean));
  return Array.from(values).sort();
}

const datePresets: { key: DatePreset; label: string }[] = [
  { key: 'all', label: 'All Time' },
  { key: '7days', label: 'Last 7 Days' },
  { key: 'lastWeek', label: 'Last Week' },
  { key: 'thisWeek', label: 'This Week' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'thisQuarter', label: 'This Quarter' },
  { key: 'lastQuarter', label: 'Last Quarter' },
  { key: 'custom', label: 'Custom' },
];

export function LeadFilters({ filters, onChange, leads }: Props) {
  const [quickExpanded, setQuickExpanded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const activeCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'search') return !!v;
    if (k === 'datePreset') return v !== 'all';
    if (k === 'convertedDatePreset') return v !== 'all';
    if (k === 'customDateFrom' || k === 'customDateTo' || k === 'convertedDateFrom' || k === 'convertedDateTo') return false;
    if (Array.isArray(v)) return v.length > 0;
    return v !== 'all';
  }).length;

  const update = (key: keyof FilterState, value: string | string[]) => {
    onChange({ ...filters, [key]: value });
  };

  const updateDatePreset = (key: 'datePreset' | 'convertedDatePreset', value: DatePreset) => {
    onChange({ ...filters, [key]: value });
  };

  const reset = () => onChange(defaultFilters);

  const associates = getUnique(leads, 'associate');
  const statuses = getUnique(leads, 'status');
  const stageNames = getUnique(leads, 'stageName');
  const centers = getUnique(leads, 'center');
  const sourceNames = getUnique(leads, 'sourceName');
  const channels = getUnique(leads, 'channel');
  const conversionStatuses = getUnique(leads, 'conversionStatus');
  const trialStatuses = getUnique(leads, 'trialStatus');

  return (
    <div className="glass-strong overflow-hidden rounded-[22px] shadow-glass">
      {/* Search Row */}
      <div className="dashboard-header-panel flex items-center gap-3 border-b border-white/10 p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
          <Input
            placeholder="Search leads by name, email, phone, or ID..."
            value={filters.search}
            onChange={(e) => update('search', e.target.value)}
            className="h-10 rounded-xl border-white/20 bg-white/10 pl-10 text-sm text-white placeholder:text-slate-300 focus:ring-2 focus:ring-sky-300/30"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuickExpanded(!quickExpanded)}
          className="h-10 gap-2 rounded-xl border-white/20 bg-white/10 px-4 text-sm text-white transition-all hover:bg-white/15"
        >
          <Calendar className="h-4 w-4" />
          Quick Filters
          {quickExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="h-10 gap-2 rounded-xl border-white/20 bg-white/10 px-4 text-sm text-white transition-all hover:bg-white/15"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={reset} className="h-10 gap-1.5 rounded-xl text-sm text-white hover:bg-white/15 hover:text-white">
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* Quick Filters Row - always visible */}
      <AnimatePresence>
        {quickExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-3">
              {/* Date Presets */}
              <DatePresetGroup
                label="Created"
                value={filters.datePreset}
                onChange={(value) => updateDatePreset('datePreset', value)}
              />
              {filters.datePreset === 'custom' && (
                <div className="grid gap-3 rounded-2xl border border-border/50 bg-background/50 p-3 sm:grid-cols-2">
                  <DatePickerField label="Created from" value={filters.customDateFrom} onChange={(value) => update('customDateFrom', value)} />
                  <DatePickerField label="Created to" value={filters.customDateTo} onChange={(value) => update('customDateTo', value)} />
                </div>
              )}

              <DatePresetGroup
                label="Converted"
                value={filters.convertedDatePreset}
                onChange={(value) => updateDatePreset('convertedDatePreset', value)}
              />
              {filters.convertedDatePreset === 'custom' && (
                <div className="grid gap-3 rounded-2xl border border-border/50 bg-background/50 p-3 sm:grid-cols-2">
                  <DatePickerField label="Converted from" value={filters.convertedDateFrom} onChange={(value) => update('convertedDateFrom', value)} />
                  <DatePickerField label="Converted to" value={filters.convertedDateTo} onChange={(value) => update('convertedDateTo', value)} />
                </div>
              )}

              {/* Location Quick Chips */}
              <div className="flex items-center gap-2 flex-wrap">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <button
                  onClick={() => update('center', 'all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filters.center === 'all'
                      ? 'dashboard-header-panel shadow-sm'
                      : 'bg-background/60 text-muted-foreground hover:bg-sky-50 hover:text-foreground border border-border/40'
                  }`}
                >All Locations</button>
                {centers.map(c => (
                  <button
                    key={c}
                    onClick={() => update('center', filters.center === c ? 'all' : c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      filters.center === c
                        ? 'dashboard-header-panel shadow-sm'
                        : 'bg-background/60 text-muted-foreground hover:bg-sky-50 hover:text-foreground border border-border/40'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              {/* Associate Quick Chips */}
              <div className="flex items-center gap-2 flex-wrap">
                <UserCircle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <button
                  onClick={() => update('associate', 'all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filters.associate === 'all'
                      ? 'dashboard-header-panel shadow-sm'
                      : 'bg-background/60 text-muted-foreground hover:bg-sky-50 hover:text-foreground border border-border/40'
                  }`}
                >All Associates</button>
                {associates.map(a => (
                  <button
                    key={a}
                    onClick={() => update('associate', filters.associate === a ? 'all' : a)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      filters.associate === a
                        ? 'dashboard-header-panel shadow-sm'
                        : 'bg-background/60 text-muted-foreground hover:bg-sky-50 hover:text-foreground border border-border/40'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Advanced Filters */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 px-4 pb-4 border-t border-border/30 pt-4">
              <FilterMultiSelect label="Status" value={filters.status} options={statuses} onChange={(v) => update('status', v)} />
              <FilterMultiSelect label="Stage" value={filters.stageName} options={stageNames} onChange={(v) => update('stageName', v)} />
              <FilterMultiSelect label="Source" value={filters.sourceName} options={sourceNames} onChange={(v) => update('sourceName', v)} />
              <FilterMultiSelect label="Channel" value={filters.channel} options={channels} onChange={(v) => update('channel', v)} />
              <FilterMultiSelect label="Conversion" value={filters.conversionStatus} options={conversionStatuses} onChange={(v) => update('conversionStatus', v)} />
              <FilterMultiSelect label="Trial Status" value={filters.trialStatus} options={trialStatuses} onChange={(v) => update('trialStatus', v)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterMultiSelect({ label, value, options, onChange }: { label: string; value: string[]; options: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</label>
      <MultiSelectDropdown
        label={label}
        options={options}
        selected={value}
        onChange={onChange}
        allLabel="All"
        buttonClassName="h-10 w-full justify-between rounded-xl border-border/40 bg-background/70 px-3 text-sm font-normal text-foreground"
      />
    </div>
  );
}

function DatePresetGroup({ label, value, onChange }: { label: string; value: DatePreset; onChange: (value: DatePreset) => void }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/50 p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <Calendar className="h-3.5 w-3.5 text-sky-700 dark:text-sky-300" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {datePresets.map((preset) => (
          <button
            key={`${label}-${preset.key}`}
            onClick={() => onChange(preset.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              value === preset.key
                ? 'dashboard-header-panel shadow-sm'
                : 'border border-border/40 bg-background/70 text-muted-foreground hover:border-sky-300 hover:bg-sky-50 hover:text-foreground dark:hover:bg-sky-950/40'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
