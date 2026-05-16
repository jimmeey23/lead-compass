import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ChevronsDown, LayoutGrid, Users } from 'lucide-react';
import type { GroupableLeadKey, Lead, LeadOptionSets } from '@/types/leads';
import { cleanLooseText, getLeadFieldValue } from '@/lib/lead-utils';
import { LeadDrillDown } from './LeadDrillDown';
import { LeadSourceBadge, LeadStageBadge, LeadStatusBadge } from './LeadDisplay';
import { Button } from '@/components/ui/button';

interface Props {
  leads: Lead[];
  allLeads: Lead[];
  options: LeadOptionSets;
  groupBy: Extract<GroupableLeadKey, 'stageName' | 'center'>;
  title: string;
}

const INITIAL_CARDS_PER_COLUMN = 24;
const LOAD_MORE_COUNT = 24;

export function LeadBoard({ leads, allLeads, options, groupBy, title }: Props) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});

  const groups = useMemo(() => {
    const grouped = new Map<string, Lead[]>();

    for (const lead of leads) {
      const label = getLeadFieldValue(lead, groupBy) || 'Unassigned';
      if (!grouped.has(label)) {
        grouped.set(label, []);
      }
      grouped.get(label)?.push(lead);
    }

    return Array.from(grouped.entries())
      .map(([label, items]) => ({ label, items }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [groupBy, leads]);

  useEffect(() => {
    setVisibleCounts((current) => {
      const next: Record<string, number> = {};
      for (const group of groups) {
        next[group.label] = current[group.label] ?? INITIAL_CARDS_PER_COLUMN;
      }
      return next;
    });
  }, [groups]);

  const totalRenderedCards = useMemo(
    () => groups.reduce((sum, group) => sum + Math.min(group.items.length, visibleCounts[group.label] ?? INITIAL_CARDS_PER_COLUMN), 0),
    [groups, visibleCounts],
  );

  return (
    <>
      <div className="glass-strong rounded-xl shadow-elevated overflow-hidden">
        <div className="dashboard-header-panel border-b border-white/10 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-sky-200" />
              {title}
            </h3>
            <p className="text-xs text-slate-300 mt-1">Grouped by {groupBy === 'stageName' ? 'stage' : 'center'} for quick scanning.</p>
          </div>
          <span className="text-xs text-slate-300">{groups.length} columns • {totalRenderedCards} cards rendered</span>
        </div>

        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-4 p-4">
            {groups.map((group) => {
              const visibleCount = visibleCounts[group.label] ?? INITIAL_CARDS_PER_COLUMN;
              const visibleItems = group.items.slice(0, visibleCount);
              const remaining = Math.max(0, group.items.length - visibleItems.length);

              return (
                <section key={group.label} className="w-[276px] shrink-0 overflow-hidden rounded-xl border border-border/60 bg-background/80 shadow-card">
                  <header className="dashboard-header-panel flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white">{group.label}</h4>
                      <p className="text-[11px] text-slate-300">{group.items.length} lead{group.items.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center ring-1 ring-white/15">
                      <Users className="h-4 w-4 text-sky-200" />
                    </div>
                  </header>

                  <div className="max-h-[calc(100vh-280px)] space-y-3 overflow-y-auto p-3">
                    {visibleItems.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => setSelectedLead(lead)}
                        className="w-full rounded-xl border border-border/55 bg-background p-3 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50/70 dark:hover:bg-sky-950/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{lead.fullName}</p>
                            <p className="text-xs text-muted-foreground mt-1">{cleanLooseText(lead.associate) || 'Unassigned associate'}</p>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{lead.createdAt || '—'}</span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <LeadStatusBadge label={lead.status} className="min-w-[112px]" />
                          <LeadStageBadge label={lead.stageName} className="min-w-[132px]" />
                          <LeadSourceBadge label={lead.sourceName} className="min-w-[132px]" />
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <span>Center: {lead.center || '—'}</span>
                          <span>Channel: {lead.channel || '—'}</span>
                        </div>
                      </button>
                    ))}

                    {remaining > 0 && (
                      <div className="sticky bottom-0 border-t border-border/20 bg-background/95 pt-3 backdrop-blur-sm">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full rounded-xl justify-center gap-2"
                          onClick={() => setVisibleCounts((current) => ({
                            ...current,
                            [group.label]: Math.min(group.items.length, visibleCount + LOAD_MORE_COUNT),
                          }))}
                        >
                          <ChevronsDown className="h-4 w-4" />
                          Load {Math.min(LOAD_MORE_COUNT, remaining)} more
                        </Button>
                        <p className="mt-2 text-center text-[11px] text-muted-foreground">{remaining} more hidden to keep the board fast.</p>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedLead && (
          <>
            <div className="fixed inset-0 bg-foreground/10 backdrop-blur-sm z-[88]" onClick={() => setSelectedLead(null)} />
            <LeadDrillDown lead={selectedLead} allLeads={allLeads} options={options} onClose={() => setSelectedLead(null)} />
          </>
        )}
      </AnimatePresence>
    </>
  );
}
