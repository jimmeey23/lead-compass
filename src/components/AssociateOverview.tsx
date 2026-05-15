import { Fragment, useState, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Lead, AssociateStats, LeadOptionSets } from '@/types/leads';
import { isOverdue } from '@/hooks/useLeadsData';
import { TrendingUp, Users, AlertTriangle, UserCheck, Target, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LeadDrillDown } from './LeadDrillDown';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { LeadHoverInfo, LeadSourceBadge, LeadStageBadge, LeadStatusBadge } from './LeadDisplay';
import { isSalesConvertedLead } from '@/lib/lead-utils';

interface Props {
  leads: Lead[];
  allLeads: Lead[];
  options: LeadOptionSets;
}

type AssociateSortKey = keyof Pick<AssociateStats, 'name' | 'totalLeads' | 'converted' | 'lost' | 'active' | 'conversionRate' | 'closeRate' | 'avgFollowUps' | 'scheduledFollowUps' | 'avgVisits' | 'avgLtv' | 'centersCovered' | 'overdueFollowUps' | 'totalLtv'>;

function isLostLead(lead: Lead): boolean {
  return /lost|not interested|lead dropped|dropped|dead|cancel/i.test(`${lead.status} ${lead.stageName}`);
}

export function computeAssociateStats(leads: Lead[]): AssociateStats[] {
  const map = new Map<string, Lead[]>();
  leads.forEach(l => {
    if (!l.associate) return;
    if (!map.has(l.associate)) map.set(l.associate, []);
    map.get(l.associate)!.push(l);
  });

  return Array.from(map.entries()).map(([name, aLeads]) => {
    const converted = aLeads.filter(isSalesConvertedLead).length;
    const lost = aLeads.filter(isLostLead).length;
    const active = aLeads.filter(l => !isLostLead(l) && !isSalesConvertedLead(l)).length;
    const totalFollowUps = aLeads.reduce((sum, l) => sum + l.followUps.filter(f => f.date && f.date !== '-').length, 0);
    const overdueFollowUps = aLeads.reduce((sum, l) => sum + l.followUps.filter(f => isOverdue(f.date, l.status)).length, 0);
    const totalLtv = aLeads.reduce((sum, l) => sum + l.ltv, 0);
    const totalVisits = aLeads.reduce((sum, l) => sum + l.visits, 0);
    const centersCovered = new Set(aLeads.map((lead) => lead.center).filter(Boolean)).size;
    const closeBase = converted + lost;

    return {
      name, totalLeads: aLeads.length, converted, lost, active,
      conversionRate: aLeads.length > 0 ? (converted / aLeads.length) * 100 : 0,
      avgFollowUps: aLeads.length > 0 ? totalFollowUps / aLeads.length : 0,
      overdueFollowUps,
      totalLtv,
      avgLtv: aLeads.length > 0 ? totalLtv / aLeads.length : 0,
      avgVisits: aLeads.length > 0 ? totalVisits / aLeads.length : 0,
      scheduledFollowUps: totalFollowUps,
      closeRate: closeBase > 0 ? (converted / closeBase) * 100 : 0,
      centersCovered,
    };
  }).sort((a, b) => b.totalLeads - a.totalLeads);
}

export function AssociateOverview({ leads, allLeads, options }: Props) {
  const stats = computeAssociateStats(leads);
  const [expandedAssociate, setExpandedAssociate] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [sortKey, setSortKey] = useState<AssociateSortKey>('totalLeads');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const totalLeads = leads.length;
  const needsAction = leads.filter(l => l.followUps.some(f => isOverdue(f.date, l.status))).length;
  const totalConverted = leads.filter(isSalesConvertedLead).length;
  const totalLost = leads.filter(isLostLead).length;
  const overallConvRate = totalLeads > 0 ? ((totalConverted / totalLeads) * 100).toFixed(1) : '0';
  const totalRevenue = leads.reduce((sum, lead) => sum + lead.ltv, 0);
  const avgVisits = totalLeads > 0 ? (leads.reduce((sum, lead) => sum + lead.visits, 0) / totalLeads).toFixed(1) : '0.0';

  const associateLeads = useMemo(() => {
    if (!expandedAssociate) return [];
    return leads.filter(l => l.associate === expandedAssociate);
  }, [leads, expandedAssociate]);

  const allAssociateStats = useMemo(() => computeAssociateStats(allLeads), [allLeads]);
  const sortedStats = useMemo(() => {
    return [...stats].sort((a, b) => {
      const valueA = a[sortKey];
      const valueB = b[sortKey];
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortDir === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
      }

      const numberA = Number(valueA);
      const numberB = Number(valueB);
      return sortDir === 'asc' ? numberA - numberB : numberB - numberA;
    });
  }, [sortDir, sortKey, stats]);

  const toggleSort = (key: AssociateSortKey) => {
    if (sortKey === key) {
      setSortDir((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(key);
    setSortDir(key === 'name' ? 'asc' : 'desc');
  };

  const SortIcon = ({ column }: { column: AssociateSortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 opacity-35" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />;
  };

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-7">
        <SummaryCard icon={Users} label="Total Leads" value={totalLeads} />
        <SummaryCard icon={AlertTriangle} label="Needs Action" value={needsAction} />
        <SummaryCard icon={UserCheck} label="Converted" value={totalConverted} />
        <SummaryCard icon={TrendingUp} label="Lost" value={totalLost} />
        <SummaryCard icon={Target} label="Conv. Rate" value={`${overallConvRate}%`} />
        <SummaryCard icon={TrendingUp} label="Revenue" value={formatCompactIndianCurrency(totalRevenue)} />
        <SummaryCard icon={Target} label="Avg Visits" value={avgVisits} />
      </div>

      {/* Associate Table */}
      <div className="glass-strong rounded-2xl shadow-elevated overflow-hidden">
        <div className="px-5 py-3 border-b border-border/30 bg-background/70">
          <h3 className="text-sm font-semibold text-foreground">Associate Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0" style={{ minWidth: '1220px' }}>
            <thead className="sticky top-0 z-10 lead-table-head">
              <tr className="lead-table-header">
                {([
                  ['Associate', 'name'],
                  ['Leads', 'totalLeads'],
                  ['Converted', 'converted'],
                  ['Lost', 'lost'],
                  ['Active', 'active'],
                  ['Conv. Rate', 'conversionRate'],
                  ['Close Rate', 'closeRate'],
                  ['Avg FU', 'avgFollowUps'],
                  ['Sched FU', 'scheduledFollowUps'],
                  ['Avg Visits', 'avgVisits'],
                  ['Avg LTV', 'avgLtv'],
                  ['Centers', 'centersCovered'],
                  ['Overdue', 'overdueFollowUps'],
                  ['Revenue', 'totalLtv'],
                ] as Array<[string, AssociateSortKey]>).map(([label, key]) => (
                  <th
                    key={label}
                    onClick={() => toggleSort(key)}
                    className="h-12 cursor-pointer px-5 text-left align-middle text-[10px] font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap transition-colors"
                  >
                    <span className="inline-flex items-center gap-1.5">{label} <SortIcon column={key} /></span>
                  </th>
                ))}
                <th className="h-12 px-5 text-left align-middle font-semibold text-slate-300 text-[10px] uppercase tracking-wider whitespace-nowrap" />
              </tr>
            </thead>
            <tbody>
              {sortedStats.map(s => (
                <Fragment key={s.name}>
                  <tr
                    onClick={() => setExpandedAssociate(expandedAssociate === s.name ? null : s.name)}
                    className="group cursor-pointer border-b border-border/20 bg-white/75 transition-colors duration-150 odd:bg-background/88 even:bg-slate-50/78 hover:bg-slate-100"
                  >
                    <td className="px-5 py-3 text-sm font-medium text-foreground whitespace-nowrap">{s.name}</td>
                    <td className="px-5 py-3 text-sm font-mono text-foreground">{s.totalLeads}</td>
                    <td className="px-5 py-3 text-sm font-mono font-medium text-foreground">{s.converted}</td>
                    <td className="px-5 py-3 text-sm font-mono text-muted-foreground">{s.lost}</td>
                    <td className="px-5 py-3 text-sm font-mono text-foreground">{s.active}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-border/40">
                          <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(s.conversionRate, 100)}%` }} />
                        </div>
                        <span className="text-xs font-mono font-medium text-foreground whitespace-nowrap">{s.conversionRate.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-foreground whitespace-nowrap">{s.closeRate.toFixed(1)}%</td>
                    <td className="px-5 py-3 text-sm font-mono text-muted-foreground">{s.avgFollowUps.toFixed(1)}</td>
                    <td className="px-5 py-3 text-sm font-mono text-foreground">{s.scheduledFollowUps}</td>
                    <td className="px-5 py-3 text-sm font-mono text-foreground">{s.avgVisits.toFixed(1)}</td>
                    <td className="px-5 py-3 text-sm font-mono text-foreground whitespace-nowrap">{formatCompactIndianCurrency(s.avgLtv)}</td>
                    <td className="px-5 py-3 text-sm font-mono text-foreground">{s.centersCovered}</td>
                    <td className={`px-5 py-3 text-sm font-mono ${s.overdueFollowUps > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                      {s.overdueFollowUps > 0 && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-blue-600" />}
                      {s.overdueFollowUps}
                    </td>
                    <td className="px-5 py-3 text-sm font-mono font-medium text-foreground whitespace-nowrap">{formatCompactIndianCurrency(s.totalLtv)}</td>
                    <td className="px-5 py-3">
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expandedAssociate === s.name ? 'rotate-90' : ''}`} />
                    </td>
                  </tr>

                  {/* Expanded leads for this associate */}
                  {expandedAssociate === s.name && (
                    <tr>
                      <td colSpan={14} className="p-0 border-b border-border/15">
                        <div className="bg-blue-50/45 px-5 py-3">
                          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                            {s.name}'s Leads ({associateLeads.length})
                          </p>
                          <div className="overflow-x-auto rounded-xl border border-border/30 bg-background/50">
                            <table className="w-full border-separate border-spacing-0">
                              <thead className="lead-table-head">
                                <tr className="lead-table-header">
                                  {['Name', 'Date', 'Stage', 'Status', 'Source', 'Remarks', 'LTV'].map(h => (
                                    <th key={h} className="h-10 px-4 text-left text-[10px] uppercase tracking-wider font-semibold text-slate-300 whitespace-nowrap">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {associateLeads.map(lead => (
                                  <tr
                                    key={lead.id}
                                    onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); }}
                                    className="cursor-pointer border-b border-border/20 bg-white/75 transition-colors duration-150 odd:bg-background/88 even:bg-slate-50/78 hover:bg-slate-100"
                                  >
                                    <td className="px-4 py-2.5">
                                      <HoverCard openDelay={120} closeDelay={120}>
                                        <HoverCardTrigger asChild>
                                          <span className="text-sm font-medium text-foreground whitespace-nowrap cursor-default">{lead.fullName}</span>
                                        </HoverCardTrigger>
                                        <HoverCardContent side="right" align="start" className="z-[120] w-[440px] rounded-2xl border border-border/50 bg-background/95 p-4 shadow-elevated">
                                          <LeadHoverInfo lead={lead} />
                                        </HoverCardContent>
                                      </HoverCard>
                                    </td>
                                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono whitespace-nowrap">{lead.createdAt}</td>
                                    <td className="px-4 py-2.5 text-xs font-semibold text-foreground whitespace-nowrap">{lead.stageName}</td>
                                    <td className="px-4 py-2.5 text-xs text-foreground whitespace-nowrap">{lead.status}</td>
                                    <td className="px-4 py-2.5 text-xs text-foreground whitespace-nowrap">{lead.sourceName}</td>
                                    <td className="px-4 py-2.5">
                                      <span className="text-[11px] text-muted-foreground truncate block max-w-[180px] cursor-default">{lead.remarks && lead.remarks !== '-' ? lead.remarks : '—'}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-xs font-mono text-foreground font-medium whitespace-nowrap">
                                      {lead.ltv > 0 ? `₹${lead.ltv.toLocaleString()}` : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drill-down panel */}
      <AnimatePresence>
        {selectedLead && (
          <>
            <div className="fixed inset-0 bg-foreground/10 backdrop-blur-sm z-40" onClick={() => setSelectedLead(null)} />
            <LeadDrillDown
              lead={selectedLead}
              allLeads={allLeads}
              options={options}
              associateStats={allAssociateStats.find(a => a.name === selectedLead.associate)}
              onClose={() => setSelectedLead(null)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number | string }) {
  return (
    <div className="glass-strong rounded-2xl shadow-card p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold font-mono text-foreground">{value}</p>
    </div>
  );
}

function formatCompactIndianCurrency(value: number) {
  const abs = Math.abs(value);
  if (abs >= 10000000) return `₹${(value / 10000000).toFixed(abs >= 100000000 ? 0 : 1)}Cr`;
  if (abs >= 100000) return `₹${(value / 100000).toFixed(abs >= 1000000 ? 0 : 1)}L`;
  if (abs >= 1000) return `₹${(value / 1000).toFixed(abs >= 10000 ? 0 : 1)}K`;
  return `₹${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
